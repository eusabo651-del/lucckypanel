#include <iostream>
#include <string>
#include <thread>
#include <chrono>
#include <vector>
#include <cmath>
#include <algorithm>
#include <sstream>
#include <fstream>
#include <sys/stat.h>
#include <sys/types.h>

// Bibliotecas externas
// #include <opencv2/opencv.hpp>
// #include <opencv2/dnn.hpp>

//
struct MobileAimConfig {
    std::string adbPath = "adb"; 
    std::string deviceSerial = ""; 
    int screenWidth = 1080;       //
    int screenHeight = 1920;      // Resolucao
    int crosshairX = 540;         // Pose da mira (sem erru)
    int crosshairY = 960;
    float smoothingFactor = 0.4f;
    int maxSwipeDistance = 150;   // Distância máxima pixels
    int aimOffsetY = 40;          // pixels
    int gestureDurationMs = 50;   //
    bool enabled = true;
    bool isAiming = false;        //"
};

//
struct MobileTarget {
    int x;
    int y;
    float confidence;
    bool isValid() const { return confidence > 0.0f; }
};

// Classe principal do Aimbot Mobile
class MobileAimbot {
private:
    MobileAimConfig config;
    std::atomic<bool> running{ true };
    std::thread* workerThread;
    
    // Estado do movimento suavizado
    int lastDx = 0;
    int lastDy = 0;

    // Função auxiliar para executar comandos adb
    std::string executeAdb(const std::string& command) {
        std::string fullCommand = config.adbPath;
        if (!config.deviceSerial.empty()) {
            fullCommand += " -s " + config.deviceSerial;
        }
        fullCommand += " " + command;
        
        std::stringstream output;
        std::string cmd = fullCommand + " 2>&1";
        FILE* pipe = popen(cmd.c_str(), "r");
        if (!pipe) return "";
        
        char buffer[128];
        while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
            output << buffer;
        }
        pclose(pipe);
        return output.str();
    }

    // Captura a tela do dispositivo Android
    // Retorna um buffer de bytes (PNG)
    std::vector<unsigned char> captureScreen() {
        std::string command = "exec-out screencap -p";
        std::string pngData = executeAdb(command);
        
        // Remove possíveis caracteres de controle
        pngData.erase(std::remove_if(pngData.begin(), pngData.end(), 
                                     [](unsigned char c) { return std::isspace(c); }), pngData.end());
        
        return std::vector<unsigned char>(pngData.begin(), pngData.end());
    }

    // Detecta alvos na tela (Simulado aqui, em produção use OpenCV/YOLO)
    std::vector<MobileTarget> detectTargets(const std::vector<unsigned char>& screenBuffer) {
        // Em produção, você usaria OpenCV para decodificar o PNG e detectar alvos
        // Exemplo:
        // cv::Mat img = cv::imdecode(cv::Mat(1, 1, CV_8UC1, screenBuffer.data()), cv::IMREAD_COLOR);
        // std::vector<MobileTarget> targets;
        // // Lógica de detecção (Template Matching, YOLO, etc.)
        // return targets;
        
        // Simulação: Retorna um alvo fixo
        std::vector<MobileTarget> targets;
        targets.push_back({ 560, 920, 1.0f }); // Alvo simulado
        return targets;
    }

    // Calcula o vetor de mira com suavização
    void calculateMovement(int targetX, int targetY) {
        int dx = (targetX - config.crosshairX);
        int dy = (targetY - config.crosshairY) - config.aimOffsetY;

        // Aplica suavização (Lerp)
        int newDx = lastDx + static_cast<int>((dx - lastDx) * config.smoothingFactor);
        int newDy = lastDy + static_cast<int>((dy - lastDy) * config.smoothingFactor);

        // Limita o movimento por frame
        newDx = std::clamp(newDx, -config.maxSwipeDistance, config.maxSwipeDistance);
        newDy = std::clamp(newDy, -config.maxSwipeDistance, config.maxSwipeDistance);

        lastDx = newDx;
        lastDy = newDy;
    }

    // Executa um gesto de arrasto (swipe) no dispositivo
    void performSwipe(int startX, int startY, int endX, int endY, int durationMs) {
        std::string command = "shell input swipe " + 
                              std::to_string(startX) + " " + 
                              std::to_string(startY) + " " + 
                              std::to_string(endX) + " " + 
                              std::to_string(endY) + " " + 
                              std::to_string(durationMs);
        executeAdb(command);
    }

    
    void performTap(int x, int y) {
        std::string command = "shell input tap " + std::to_string(x) + " " + std::to_string(y);
        executeAdb(command);
    }

    // 
    void loop() {
        while (running) {
            if (!config.enabled) {
                std::this_thread::sleep_for(std::chrono::milliseconds(10));
                continue;
            }

            
            auto screenBuffer = captureScreen();
            
            if (screenBuffer.empty()) {
                std::cerr << "Erro ao capturar a tela." << std::endl;
                std::this_thread::sleep_for(std::chrono::milliseconds(100));
                continue;
            }

            // detectacao
            auto targets = detectTargets(screenBuffer);
            
            if (!targets.empty()) {
                // Escolhe o melhor alvo (ex: maior confiança, mais próximo)
                MobileTarget bestTarget = targets[0];
                
                if (bestTarget.isValid()) {
                    calculateMovement(bestTarget.x, bestTarget.y);
                    
                    // 3. Executa o gesto de mira
                    int startX = config.crosshairX;
                    int startY = config.crosshairY;
                    int endX = startX + lastDx;
                    int endY = startY + lastDy;
                    
                    performSwipe(startX, startY, endX, endY, config.gestureDurationMs);
                }
            }

            // Ajusta o frame rate (ex: 30 FPS para capturas via adb)
            std::this_thread::sleep_for(std::chrono::milliseconds(33));
        }
    }

public:
    MobileAimbot(const MobileAimConfig& cfg) : config(cfg) {}

    ~MobileAimbot() {
        stop();
    }

    void start() {
        workerThread = new std::thread(&MobileAimbot::loop, this);
        std::cout << "Mobile Aimbot iniciado." << std::endl;
    }

    void stop() {
        running = false;
        if (workerThread && workerThread->joinable()) {
            workerThread->join();
        }
        delete workerThread;
        workerThread = nullptr;
        std::cout << "Mobile Aimbot finalizado." << std::endl;
    }

    void toggle() {
        config.enabled = !config.enabled;
        std::cout << (config.enabled ? "Aimbot ATIVADO" : "Aimbot DESATIVADO") << std::endl;
    }

    void setSmoothing(float factor) {
        config.smoothingFactor = std::clamp(factor, 0.1f, 1.0f);
    }

    void setAimOffset(int yOffset) {
        config.aimOffsetY = yOffset;
    }
};

// Função auxiliar para verificar se o adb está disponível
bool checkAdbAvailability(const std::string& adbPath) {
    std::string command = adbPath + " version";
    std::stringstream output;
    std::string cmd = command + " 2>&1";
    FILE* pipe = popen(cmd.c_str(), "r");
    if (!pipe) return false;
    
    char buffer[128];
    bool found = false;
    while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
        if (std::string(buffer).find("Android Debug Bridge") != std::string::npos) {
            found = true;
        }
    }
    pclose(pipe);
    return found;
}

int main() {
    MobileAimConfig config;
    config.adbPath = "adb";
    config.deviceSerial = "";
    config.screenWidth = 1080;
    config.screenHeight = 1920;
    config.crosshairX = 540;
    config.crosshairY = 960;
    config.smoothingFactor = 0.4f;
    config.aimOffsetY = 40;
    config.gestureDurationMs = 50;


    if (!checkAdbAvailability(config.adbPath)) {
        std::cerr << "Erro: adb não encontrado. Verifique o caminho do executável." << std::endl;
        return 1;
    }


    std::string devices = "devices";
    std::stringstream output;
    std::string cmd = config.adbPath + " " + devices + " 2>&1";
    FILE* pipe = popen(cmd.c_str(), "r");
    if (pipe) {
        char buffer[128];
        while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
            std::cout << buffer;
        }
        pclose(pipe);
    }

    MobileAimbot aimbot(config);
    aimbot.start();

    std::cout << "Pressione 'q' para sair, 't' para toggle, 's' para ajustar suavização." << std::endl;

    while (true) {
        char cmd;
        std::cin >> cmd;

        switch (cmd) {
            case 'q':
                aimbot.stop();
                return 0;
            case 't':
                aimbot.toggle();
                break;
            case 's':
                aimbot.setSmoothing(0.5f);
                std::cout << "Suavização ajustada para 0.5" << std::endl;
                break;
            default:
                break;
        }
        
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }

    return 0;
}
