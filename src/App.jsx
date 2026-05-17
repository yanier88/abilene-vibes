import { useState } from "react";
import bgImage from "./assets/WhatsApp Image 2026-05-16 at 2.18.47 PM.jpeg";
function App() {
  const [page, setPage] = useState("home");

  const events = [
    {
      title: "Live Music Friday",
      place: "The Paramount Theatre",
      date: "May 24, 2025 • 8:00 PM",
      type: "LIVE MUSIC",
      image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a",
    },
    {
      title: "Neon Nights",
      place: "The Station Lounge",
      date: "May 24, 2025 • 10:00 PM",
      type: "NIGHTLIFE",
      image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819",
    },
    {
      title: "Taco & Tequila Fest",
      place: "Frontier Texas! Courtyard",
      date: "May 25, 2025 • 5:00 PM",
      type: "FOOD & DRINKS",
      image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47",
    },
    {
      title: "Country Night",
      place: "Potosi Live",
      date: "May 26, 2025 • 9:00 PM",
      type: "COUNTRY",
      image: "https://images.unsplash.com/photo-1506157786151-b8491531f063",
    },
    {
      title: "Art & Food Market",
      place: "Downtown Abilene",
      date: "May 27, 2025 • 4:00 PM",
      type: "FAMILY",
      image: "https://images.unsplash.com/photo-1481833761820-0509d3217039",
    },
  ];

  if (page === "events") {
    return (
      <div
        style={{
          backgroundColor: "#050008",
          minHeight: "100vh",
          color: "white",
          padding: "40px 20px",
          fontFamily: "Arial",
        }}
      ><img
/>
        <button
          onClick={() => setPage("home")}
          style={{
            backgroundColor: "#ff00cc",
            color: "white",
            padding: "12px 22px",
            border: "none",
            borderRadius: "12px",
            fontSize: "16px",
            cursor: "pointer",
            marginBottom: "25px",
          }}
        >
          ← Back Home
        </button>

        <h1 style={{ textAlign: "center", fontSize: "42px" }}>
          Events in Abilene 🎉
        </h1>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {events.map((event, index) => (
            <div
  key={index}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "scale(1.03)"
    e.currentTarget.style.boxShadow = "0 0 35px rgba(255,0,204,0.9)"
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "scale(1)"
    e.currentTarget.style.boxShadow = "0 0 20px rgba(255,0,204,0.4)"
              }}
              style={{
                display: "flex",
                gap: "20px",
                maxWidth: "900px",
                margin: "25px auto",
                width: "90%",
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.06)",
                border: "2px solid #ff00cc",
                borderRadius: "20px",
                padding: "15px",
                boxShadow: "0 0 20px rgba(255,0,204,0.4)",
                transition: "0.3s",
                cursor: "pointer",
              }}
            >
              <img
                src={event.image}
                alt={event.title}
                style={{
                  width: "180px",
                  height: "120px",
                  objectFit: "cover",
                  borderRadius: "15px",
                }}
              />

              <div>
                <h2>{event.title}</h2>
                <p>📍 {event.place}</p>
                <p>📅 {event.date}</p>
                <p style={{ color: "#ff00cc", fontWeight: "bold" }}>
                  {event.type}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "#0f172a",
        backgroundImage: 'url("/home-banner.png")',
backgroundSize: "100% 95%",
backgroundRepeat: "no-repeat",
backgroundPosition: "top center",
        color: "white",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Arial",
        textAlign: "center",
        padding: "20px",
      }}
    >
    

    

      <button
        onClick={() => setPage("events")}
        style={{
          backgroundColor: "#ff00cc",
          color: "white",
          padding: "16px 34px",
          border: "none",
          borderRadius: "14px",
          fontSize: "20px",
          cursor: "pointer",
          fontWeight: "bold",
          boxShadow: "0 0 25px rgba(255,0,204,0.7)",
          marginTop: "200px",
          marginLeft: "-330px",
        }}
      >
        Explore Now
      </button>
    </div>
  );
}

export default App;