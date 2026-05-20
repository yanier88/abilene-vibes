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

const calendarDays = [
  {
    day: "Mon",
    date: "May 20",
    title: "Downtown Open Mic",
    time: "7:00 PM",
    place: "Grain Theory",
  },
  {
    day: "Tue",
    date: "May 21",
    title: "Taco Tuesday",
    time: "5:00 PM",
    place: "Downtown Abilene",
  },
  {
    day: "Wed",
    date: "May 22",
    title: "Trivia Night",
    time: "7:30 PM",
    place: "The Station Lounge",
  },
  {
    day: "Thu",
    date: "May 23",
    title: "College Nights",
    time: "9:00 PM",
    place: "Guitars Cadillacs Club",
  },
  {
    day: "Fri",
    date: "May 24",
    title: "Live Music Friday",
    time: "8:00 PM",
    place: "The Paramount Theatre",
  },
  {
    day: "Sat",
    date: "May 25",
    title: "Taco & Tequila Fest",
    time: "5:00 PM",
    place: "Frontier Texas! Courtyard",
  },
  {
    day: "Sun",
    date: "May 26",
    title: "Country Night",
    time: "9:00 PM",
    place: "Potosi Live",
  },
];

const nightlifePlaces = [
  {
    name: "Guitars and Cadillacs",
    image: "/nightlife-guitars.jpg",
  },
  {
    name: "Oggly Lime",
    image: "/nightlife-ugly-lime.jpg",
  },
  {
    name: "Mi Gente Club",
    image: "/nightlife-suite.jpg",
  },
  {
    name: "The Station",
    image: "/nightlife-station.jpg",
  },
  {
    name: "Club Rodeo",
    image: "/nightlife-guitars.jpg",
  },
  {
    name: "Suite",
    image: "/nightlife-suite.jpg",
  },
  {
    name: "Paramount Cine",
    image: "/nightlife-paramount.jpg",
  },
  {
    name: "Cinemark",
    image: "/nightlife-cinemark.jpg",
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
            <button className="primary-button lobby-home-button" onClick={() => setPage("home")}>
              Home
            </button>

            <button className="primary-button photo-next-button" onClick={() => setPage("events")}>
              Events
            </button>

            <button className="primary-button lobby-calendar-button" onClick={() => setPage("calendar")}>
              Calendar
            </button>

            <button className="primary-button lobby-nightlife-button" onClick={() => setPage("nightlife")}>
              Nightlife
            </button>

            <button className="primary-button lobby-eats-button" type="button">
              Eats
            </button>

            <button className="primary-button lobby-gallery-button" type="button">
              Gallery
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

  if (page === "calendar") {
    return (
      <main className="app calendar-page">
        <div className="calendar-shell">
          <button className="back-button" onClick={() => setPage("lobby")}>
            Back to lobby
          </button>

          <section className="calendar-header" aria-labelledby="calendar-title">
            <p className="eyebrow">Plan the week</p>
            <h1 id="calendar-title">Calendar</h1>
          </section>

          <section className="calendar-list" aria-label="Abilene Vibes calendar">
            {calendarDays.map((item) => (
              <article className="calendar-card" key={`${item.date}-${item.title}`}>
                <div className="calendar-date">
                  <span>{item.day}</span>
                  <strong>{item.date}</strong>
                </div>

                <div className="calendar-copy">
                  <h2>{item.title}</h2>
                  <p>{item.place}</p>
                  <p>{item.time}</p>
                </div>
              </article>
            ))}
          </section>
        </div>
      </main>
    );
  }

  if (page === "nightlife") {
    return (
      <main className="app nightlife-page">
        <div className="nightlife-shell">
          <button className="back-button" onClick={() => setPage("lobby")}>
            Back to lobby
          </button>

          <section className="nightlife-header" aria-labelledby="nightlife-title">
            <p className="eyebrow">After dark</p>
            <h1 id="nightlife-title">Nightlife</h1>
          </section>

          <section className="nightlife-grid" aria-label="Abilene nightlife places">
            {nightlifePlaces.map((place) => (
              <article className="nightlife-card" key={place.name}>
                <img className="nightlife-image" src={place.image} alt="" loading="lazy" />
                <span className="event-type">Night spot</span>
                <h2>{place.name}</h2>
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
