import { ArrowUpRight } from "lucide-react";

const discordInvite = "https://discord.gg/q5CUyHzpHm";

function App() {
  return (
    <main className="discord-gate">
      <section className="discord-gate-card" aria-labelledby="discord-gate-title">
        <span className="discord-gate-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.7 5.1A18.4 18.4 0 0 0 15.2 3.7l-.6 1.2a16.8 16.8 0 0 0-5.2 0l-.6-1.2a18.4 18.4 0 0 0-4.5 1.4C1.5 9.3.7 13.4 1.1 17.5a18.6 18.6 0 0 0 5.5 2.8l1.2-2a12 12 0 0 1-1.9-.9l.5-.4a13.2 13.2 0 0 0 11.2 0l.5.4a12 12 0 0 1-1.9.9l1.2 2a18.6 18.6 0 0 0 5.5-2.8c.5-4.8-.8-8.8-3.2-12.4ZM8.7 14.9c-1.1 0-2-.9-2-2.1s.9-2.1 2-2.1 2 .9 2 2.1-.9 2.1-2 2.1Zm6.6 0c-1.1 0-2-.9-2-2.1s.9-2.1 2-2.1 2 .9 2 2.1-.9 2.1-2 2.1Z" />
          </svg>
        </span>
        <h1 id="discord-gate-title">
          ADQUIRA SEU PROJETO DE AUXÍLIO ABAIXO COM O LINK DO DISCORD:
        </h1>
        <a className="discord-gate-url" href={discordInvite} target="_blank" rel="noopener noreferrer">
          {discordInvite}
        </a>
        <a className="discord-gate-button" href={discordInvite} target="_blank" rel="noopener noreferrer">
          IR PARA O DISCORD
          <ArrowUpRight size={18} aria-hidden="true" />
        </a>
      </section>
    </main>
  );
}

export default App;
