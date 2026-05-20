import { useState } from "react";
import "./App.css";

const events = [
  {
    title: "Live Music Friday",
    place: "The Paramount Theatre",
    date: "May 24, 2026 - 8:00 PM",
    type: "Live music",
    image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Neon Nights",
    place: "The Station Lounge",
    date: "May 24, 2026 - 10:00 PM",
    type: "Nightlife",
    image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Taco & Tequila Fest",
    place: "Frontier Texas! Courtyard",
    date: "May 25, 2026 - 5:00 PM",
    type: "Food & drinks",
    image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Country Night",
    place: "Potosi Live",
    date: "May 26, 2026 - 9:00 PM",
    type: "Country",
    image: "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Art & Food Market",
    place: "Downtown Abilene",
    date: "May 27, 2026 - 4:00 PM",
    type: "Family",
    image: "https://images.unsplash.com/photo-1481833761820-0509d3217039?auto=format&fit=crop&w=800&q=80",
  },
];

function App() {
  const [page, setPage] = useState("home");

  if (page === "lobby") {
    return (
      <main className="app photo-page">
        <section className="photo-feature" aria-label="Abilene Vibes lobby">
          <img className="photo-feature-image" src="/lobby-bg.png" alt="" />

          <div className="photo-feature-content">
            <button className="back-button" onClick={() => setPage("home")}>
              Back home
            </button>

            <button className="primary-button photo-next-button" onClick={() => setPage("events")}>
              Events
            </button>

            <button className="primary-button lobby-calendar-button" type="button">
              Calendar
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (page === "events") {
    return (
      <main className="app events-page">
        <div className="events-shell">
          <button className="back-button" onClick={() => setPage("lobby")}>
            Back to lobby
          </button>

          <section className="events-header" aria-labelledby="events-title">
            <p className="eyebrow">This week in town</p>
            <h1 id="events-title">Events in Abilene</h1>
            <p className="events-intro">
              A bright, quick-scan lineup for music, food, nightlife, and easy weekend plans.
            </p>
          </section>

          <section className="event-list" aria-label="Featured Abilene events">
            {events.map((event) => (
              <article className="event-card" key={`${event.title}-${event.date}`}>
                <img className="event-image" src={event.image} alt="" loading="lazy" />

                <div className="event-copy">
                  <span className="event-type">{event.type}</span>
                  <h2>{event.title}</h2>
                  <p className="event-detail">{event.place}</p>
                  <p className="event-detail">{event.date}</p>
                </div>
              </article>
            ))}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="app home-page">
      <section className="home-hero" aria-label="Abilene Vibes">
        <div className="home-cta">
          <button className="primary-button" onClick={() => setPage("lobby")}>
            Explore events
          </button>
        </div>
      </section>
    </main>
  );
}

export default App;
