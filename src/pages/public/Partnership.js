import React from "react";
import { Link } from "react-router-dom";
import "./Partnership.css";

export default function Partnership() {
  return (
    <main className="partnership-page">
      <section className="partnership-hero">
        <h1>DRM: THE CONNECTION</h1>
        <p className="partnership-subtitle">
          A Divine Partnership. A Kingdom Connection.
        </p>
      </section>

      <section className="partnership-content">
        {/* What is THE CONNECTION */}
        <div className="partnership-block">
          <h2>What is DRM: THE CONNECTION?</h2>
          <p>
            Being a part of <strong>DRM: THE CONNECTION</strong> is an
            individual or organization that commits to consistently pray for
            Daniel Robertson Ministries and pledges to sow into the ministry.
          </p>
        </div>

        {/* Responsibilities */}
        <div className="partnership-block">
          <h2>
            What are my responsibilities as a part of DRM: THE CONNECTION?
          </h2>
          <ul>
            <li>
              Pray for Bishop Robertson and his family on a consistent basis.
            </li>
            <li>
              Stay connected to the ministry through Facebook, Twitter,
              Instagram, and viewing the archived messages.
            </li>
            <li>
              Support the ministry financially through your monthly pledge.
            </li>
            <li>
              Write to us periodically to share how God is moving in your life.
            </li>
            <li>Attend meetings and conferences in your area.</li>
            <li>Share the ministry with others as your life is blessed.</li>
          </ul>
        </div>

        {/* Benefits */}
        <div className="partnership-block">
          <h2>What are my benefits of being a part of DRM: THE CONNECTION?</h2>
          <p>
            First and foremost, as a DRM partner, your divine connection
            positions you to receive the anointing and blessings that rest upon
            the ministry. Only those who are connected have a right to receive
            the same blessings that are on the ministry.
          </p>

          <p>In addition, we commit to:</p>

          <ol>
            <li>
              Praying for peace, power, and the provision of God to manifest in
              your household.
            </li>
            <li>Being good stewards over the resources entrusted to DRM.</li>
            <li>
              Providing teachings on messages specially selected by Bishop
              Robertson for partners only.
            </li>
            <li>
              Sending a personal letter from Bishop Robertson each quarter.
            </li>
            <li>Providing priority seating and registration at conferences.</li>
          </ol>
        </div>

        {/* CTA */}
        <div className="partnership-cta">
          <Link to="/connection" className="join-button">
            <span>Join Today</span>
            <small>Click here</small>
          </Link>
        </div>
      </section>
    </main>
  );
}
