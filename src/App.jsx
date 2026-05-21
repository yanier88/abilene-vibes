import { useState } from "react";
import "./App.css";

const appAsset = (path) => `${import.meta.env.BASE_URL}${path}`;

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
];

const nightlifePlaces = [
  {
    name: "Guitars and Cadillacs",
    image: appAsset("nightlife-guitars.jpg"),
  },
  {
    name: "Oggly Lime",
    image: appAsset("nightlife-ugly-lime.jpg"),
  },
  {
    name: "Mi Gente Club",
    image: appAsset("nightlife-suite.jpg"),
  },
  {
    name: "The Station",
    image: appAsset("nightlife-station.jpg"),
  },
  {
    name: "Club Rodeo",
    image: appAsset("nightlife-guitars.jpg"),
  },
  {
    name: "Suite",
    image: appAsset("nightlife-suite.jpg"),
  },
  {
    name: "Paramount Cine",
    image: appAsset("nightlife-paramount.jpg"),
  },
  {
    name: "Cinemark",
    image: appAsset("nightlife-cinemark.jpg"),
  },
];

const eatsPlaces = [
  {
    name: "Grain Theory",
    kind: "Brewpub",
    note: "Craft beer, burgers, and a strong downtown patio mood.",
    image: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "The Beehive",
    kind: "Steakhouse",
    note: "Classic Abilene dinner spot for date night or a slower evening.",
    image: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Vagabond Pizza",
    kind: "Pizza",
    note: "Easy slices, late conversations, and a casual downtown stop.",
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Front Porch Coffee",
    kind: "Coffee",
    note: "A low-key daytime reset before the night starts moving.",
    image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80",
  },
];

const galleryShots = [
  {
    title: "Downtown Lights",
    image: appAsset("nightlife-station.jpg"),
  },
  {
    title: "Paramount Glow",
    image: appAsset("nightlife-paramount.jpg"),
  },
  {
    title: "Club Energy",
    image: appAsset("nightlife-guitars.jpg"),
  },
  {
    title: "Movie Night",
    image: appAsset("nightlife-cinemark.jpg"),
  },
  {
    title: "Oggly Lime",
    image: appAsset("nightlife-ugly-lime.jpg"),
  },
  {
    title: "Mi Gente Club",
    image: appAsset("nightlife-suite.jpg"),
  },
  {
    title: "Guitars and Cadillacs",
    image: appAsset("nightlife-guitars.jpg"),
  },
];

const promoteCategories = [
  "Food trucks",
  "Restaurants",
  "Clubs & Bar",
  "Barber shop",
  "Hotels & rents",
  "Others",
];

const initialBusinesses = [
  {
    id: "grain-theory",
    name: "Grain Theory",
    category: "Restaurants",
    phone: "(325) 704-2500",
    social: "graintheory.com",
    description: "Downtown brewpub with food, drinks, and a strong patio crowd.",
  },
  {
    id: "guitars-cadillacs",
    name: "Guitars and Cadillacs",
    category: "Clubs & Bar",
    phone: "(325) 672-2960",
    social: "@guitarsabilene",
    description: "Country nights, dancing, and weekend energy in Abilene.",
  },
];

function App() {
  const [page, setPage] = useState("home");
  const [selectedCategory, setSelectedCategory] = useState(promoteCategories[0]);
  const [businessSubmitted, setBusinessSubmitted] = useState(false);
  const [businesses, setBusinesses] = useState(initialBusinesses);

  const handleBusinessSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const business = {
      id: `${Date.now()}-${formData.get("businessName")}`,
      name: formData.get("businessName").trim(),
      category: selectedCategory,
      phone: formData.get("phone").trim(),
      social: formData.get("social").trim(),
      description: formData.get("description").trim(),
    };

    setBusinesses((currentBusinesses) => [business, ...currentBusinesses]);
    setBusinessSubmitted(true);
    event.currentTarget.reset();
  };

  if (page === "lobby") {
    return (
      <main className="app photo-page">
        <section className="photo-feature" aria-label="Abilene Vibes lobby">
          <img className="photo-feature-image" src={appAsset("lobby-bg.png")} alt="" />

          <div className="photo-feature-content">
            <button className="primary-button lobby-home-button" onClick={() => setPage("home")}>
              Home
            </button>

            <button className="primary-button lobby-promote-button" onClick={() => setPage("promote")}>
              Promote your business
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

            <button className="primary-button lobby-eats-button" onClick={() => setPage("eats")}>
              Eats
            </button>

            <button className="primary-button lobby-gallery-button" onClick={() => setPage("gallery")}>
              Gallery
            </button>

            <button className="primary-button lobby-directory-button" onClick={() => setPage("directory")}>
              Directory
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

  if (page === "eats") {
    return (
      <main className="app eats-page">
        <div className="eats-shell">
          <button className="back-button" onClick={() => setPage("lobby")}>
            Back to lobby
          </button>

          <section className="eats-header" aria-labelledby="eats-title">
            <p className="eyebrow">Food before the fun</p>
            <h1 id="eats-title">Eats</h1>
            <p className="events-intro">
              Quick picks for dinner, coffee, and downtown stops before the night opens up.
            </p>
          </section>

          <section className="eats-grid" aria-label="Abilene restaurants and coffee spots">
            {eatsPlaces.map((place) => (
              <article className="eats-card" key={place.name}>
                <img className="eats-image" src={place.image} alt="" loading="lazy" />

                <div className="eats-copy">
                  <span className="event-type">{place.kind}</span>
                  <h2>{place.name}</h2>
                  <p>{place.note}</p>
                </div>
              </article>
            ))}
          </section>
        </div>
      </main>
    );
  }

  if (page === "gallery") {
    return (
      <main className="app gallery-page">
        <div className="gallery-shell">
          <button className="back-button" onClick={() => setPage("lobby")}>
            Back to lobby
          </button>

          <section className="gallery-header" aria-labelledby="gallery-title">
            <p className="eyebrow">City snapshots</p>
            <h1 id="gallery-title">Gallery</h1>
          </section>

          <section className="gallery-grid" aria-label="Abilene Vibes gallery">
            {galleryShots.map((shot) => (
              <figure className="gallery-card" key={shot.title}>
                <img src={shot.image} alt="" loading="lazy" />
                <figcaption>{shot.title}</figcaption>
              </figure>
            ))}
          </section>
        </div>
      </main>
    );
  }

  if (page === "promote") {
    return (
      <main className="app promote-page">
        <div className="promote-shell">
          <button className="back-button" onClick={() => setPage("lobby")}>
            Back to lobby
          </button>

          <section className="promote-header" aria-labelledby="promote-title">
            <p className="eyebrow">Local spotlight</p>
            <h1 id="promote-title">Promote your business</h1>
            <p className="events-intro">
              Choose the category that fits your business and get in front of the Abilene crowd.
            </p>
          </section>

          <section className="promote-grid" aria-label="Business promotion categories">
            {promoteCategories.map((category) => (
              <button
                className={`promote-card${selectedCategory === category ? " is-selected" : ""}`}
                key={category}
                type="button"
                onClick={() => {
                  setSelectedCategory(category);
                  setBusinessSubmitted(false);
                }}
                aria-pressed={selectedCategory === category}
              >
                <span>{category}</span>
              </button>
            ))}
          </section>

          <form className="business-form" onSubmit={handleBusinessSubmit}>
            <div className="business-form-heading">
              <p className="eyebrow">Free listing</p>
              <h2>{selectedCategory}</h2>
            </div>

            <div className="form-grid">
              <label className="form-field">
                <span>Business name</span>
                <input name="businessName" type="text" placeholder="Your business name" required />
              </label>

              <label className="form-field">
                <span>Contact name</span>
                <input name="contactName" type="text" placeholder="Who should we contact?" required />
              </label>

              <label className="form-field">
                <span>Phone</span>
                <input name="phone" type="tel" placeholder="(325) 555-0100" required />
              </label>

              <label className="form-field">
                <span>Instagram or website</span>
                <input name="social" type="text" placeholder="@business or website" />
              </label>
            </div>

            <label className="form-field form-field-wide">
              <span>Short description</span>
              <textarea name="description" placeholder="Tell people what makes your spot worth visiting." rows="4" />
            </label>

            {businessSubmitted && (
              <p className="form-success">Thanks. Your business is now visible in the local directory.</p>
            )}

            <button className="primary-button subscribe-button" type="submit">
              Subscribe free
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (page === "directory") {
    return (
      <main className="app directory-page">
        <div className="directory-shell">
          <button className="back-button" onClick={() => setPage("lobby")}>
            Back to lobby
          </button>

          <section className="directory-header" aria-labelledby="directory-title">
            <p className="eyebrow">Local guide</p>
            <h1 id="directory-title">Business Directory</h1>
            <p className="events-intro">Explore Abilene businesses shared through Abilene Vibes.</p>
          </section>

          <section className="directory-grid" aria-label="Abilene business directory">
            {businesses.map((business) => (
              <article className="directory-card" key={business.id}>
                <span className="event-type">{business.category}</span>
                <h2>{business.name}</h2>
                {business.description && <p>{business.description}</p>}

                <div className="directory-actions">
                  {business.phone && (
                    <a className="directory-link" href={`tel:${business.phone.replace(/\D/g, "")}`}>
                      Call
                    </a>
                  )}

                  {business.social && (
                    <a
                      className="directory-link"
                      href={
                        business.social.startsWith("@")
                          ? `https://instagram.com/${business.social.slice(1)}`
                          : business.social.startsWith("http")
                            ? business.social
                            : `https://${business.social}`
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      Visit
                    </a>
                  )}
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
      <section
        className="home-hero"
        style={{ "--home-hero-image": `url("${appAsset("home-new-hd.png")}")` }}
        aria-label="Abilene Vibes"
      >
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
