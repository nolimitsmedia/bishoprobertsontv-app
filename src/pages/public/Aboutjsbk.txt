// src/pages/public/About.js
import React from "react";
import "./About.css";
import BishopImage from "../../assets/bishopimage.png";
import BishopPreaching from "../../assets/bishoppreaching.jpg";
import BishopCoPastor from "../../assets/bishopcopastor.jpg";

export default function About() {
  return (
    <div className="about-page theme--dark">
      <div className="about-wrap">
        {/* LEFT: image column */}
        <aside className="about-left" aria-label="About images">
          <div className="about-imgCard about-imgCard--tall">
            <img src={BishopImage} alt="Bishop Image" className="bishopImage" />
          </div>

          <div className="about-imgCard">
            <img
              src={BishopPreaching}
              alt="Bishop Preaching"
              className="bishopPreaching"
            />
          </div>

          <div className="about-imgCard">
            <img
              src={BishopCoPastor}
              alt="Bishop Co-Pastor"
              className="bishopCopastor"
            />
          </div>
        </aside>

        {/* RIGHT: text column */}
        <main className="about-right">
          <h1 className="about-title">Bishop Daniel Robertson, Jr.</h1>

          <div className="about-body">
            <p>
              Bishop Robertson currently serves as the Senior Pastor of Mt.
              Gilead Full Gospel International Ministries located in Richmond,
              Virginia. He was consecrated into the Episcopal office of Bishop
              in November of 2003. His visionary leadership over the past 18
              years has caused the congregation to thrive while reaching the
              lost with the gospel of Jesus Christ, locally and abroad. As one
              of Central Virginia’s fastest growing churches, Mt. Gilead moved
              to its new facility on 82 acres of Promise Land in 2004. Using the
              theme, “Pursuing, Advancing, and Taking Territories,” Mt. Gilead
              continues to acquire land to follow the vision. With a heart
              focused on glorifying God, Bishop Robertson recently led a
              miraculous Debt Elimination Campaign that resulted in the
              cancellation of the remaining debt of $1.6 million in three months
              and one week. This amazing debt free testimony is now a source of
              encouragement to the Body of Christ. If you have not experienced
              this amazing debt free testimony click here to view the video.
            </p>

            <p>
              In addition to his assignment as a pastor, leader, and innovator,
              Bishop Robertson is an accomplished writer and author of four
              best-selling books on leadership. The first, “Plug In”, is a
              practical guide for pastors, church leaders and businesses
              followed by his book, “Coaching: A Kingdom Agenda”, which is an
              excellent resource for developing leaders and building a strong
              organization. His third book, “Plug In II”, is a continuation of
              the blessings of divine connection with actual stories of how this
              principle manifested in the life of Bishop Robertson as well as
              the ministry at large. In his book, “Fit for a King,” he provides
              a practical guide to excellence that will equip the kingdom to
              honor God through exceptional ministry. Bridging the gap between
              the generations, Bishop Robertson’s inspirational release entitled
              “Nothin’ But The Truth” makes a conscious attempt to reach the
              young and the young at heart with the Word of God on CD.
            </p>

            <p>
              Called to the nations, Bishop Robertson is actively involved in
              hands-on overseas missions through the Leroy Thompson Ministerial
              Association (LTMA), Shalom Outreach and Know The Truth Ministries
              in Northern Virginia. His passion for carrying out the Great
              Commission has taken him to nations abroad including: Kenya,
              Uganda, Cuba, South Africa, Guatemala, Ghana, Haiti, India,
              Brazil, and Solomon’s Island. Passion, conviction, and clarity are
              three words that appropriately describe the ministry of Bishop
              Robertson. He is a leader of leaders and his kingdom assignment
              continues to prove that God has entrusted him to equip the saints
              for the work of the ministry. Through the live streaming
              broadcasts, worship services, and best-selling books, Bishop
              Robertson executes his mandate to spread the gospel around the
              world.
            </p>

            <p>
              He currently serves as one of twelve Master Vision Bearers for
              LTMA under the leadership of Apostle Leroy Thompson, Sr. In May of
              2014, Bishop Robertson graduated from the Ever Increasing Word
              Training Center, under the direction of Apostle Thompson and was
              subsequently awarded an Honorary Doctorate Degree in Divinity.
              Without question, he is a man who remains committed and anointed
              to change lives with the Word of God. He is a devoted husband to
              his wife, Co-Pastor Elena Robertson and they are the blessed
              parents of four children: Daniel III, Charity Joy, David Jeremiah,
              and Moriah Joyelle.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
