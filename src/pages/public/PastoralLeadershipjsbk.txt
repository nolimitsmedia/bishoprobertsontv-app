// src/pages/public/PastoralLeadership.js
import React from "react";
import "./PastoralLeadership.css";
import BishopImage from "../../assets/bishopimage.png";

export default function PastoralLeadership() {
  return (
    <div className="pl-page theme--dark">
      <div className="pl-wrap">
        <header className="pl-hero" aria-label="Pastoral Leadership hero">
          <div className="pl-hero-inner">
            <div className="pl-portrait">
              <img
                src={BishopImage}
                alt="Pastoral leadership portrait"
                className="bishopImage"
              />
            </div>
          </div>
        </header>

        <main className="pl-content">
          <div className="pl-text">
            <p>
              Known as a business-savvy visionary, Bishop Robertson has a proven
              track record in economic development, land acquisition, and church
              growth. Since 1996, he has served as the Senior Pastor of Mt.
              Gilead Full Gospel International Ministries, one of Central
              Virginia’s fastest growing churches. Bishop Robertson has been
              instrumental in leading a move of God that spans over 18 years and
              includes expansive church growth and land acquisition.
            </p>

            <p>
              Mt. Gilead was previously located on three acres of land and had
              25 members when he accepted the position as senior pastor in 1996.
              Under Bishop Robertson’s leadership, Mt. Gilead is now a Mega
              Ministry. The membership is not only thriving, but it continues to
              play a critical role in “Changing Lives with the Word of God” in
              the Greater Richmond area and beyond. The Mt. Gilead campus has
              expanded to 82 acres and includes two transitional homes located
              on frontal property, a 62,000 square foot sanctuary complete with
              a state-of-the-art sound and lighting system, and plans for
              additional growth in the years ahead.
            </p>

            <p>
              Bishop Robertson is not only gifted in the areas of economic
              development and land acquisition, but he has a unique anointing to
              assist pastors in growing their ministry; both in number and in
              the underlying framework needed to support growth. As a teacher
              and coach, he offers tried and proven methods to develop a winning
              team. He has extensive experience in managing church growth and
              keeping the vision alive for all levels of the organization. His
              attention to detail combined with a God-given insight on how to
              build strong ministry teams has produced tangible and sustained
              results.
            </p>

            <p>
              If you’re looking for wisdom and insight to build a strong team
              and infrastructure for your ministry, please contact us at (804)
              675-7600 extension 116 to schedule a free phone consultation and
              discuss how we might work with you to get this resource into your
              church. Bishop Robertson is willing to travel to churches of all
              sizes because his passion is to effectively carry out his Kingdom
              assignment. He has been called and equipped “for such a time as
              this!”
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
