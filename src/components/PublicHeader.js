import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./PublicHeader.css";
import LoginModal from "./LoginModal";
import SignupModal from "./SignupModal";

export default function PublicHeader() {
  const [authed, setAuthed] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    setAuthed(!!token);
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    setAuthed(false);
    navigate("/");
    window.location.reload();
  };

  return (
    <>
      <header className="public-header">
        <div className="public-header-container">
          <div className="public-logo">
            <Link to="/">
              Bishop<span>TV</span>
            </Link>
          </div>

          <nav className="public-nav">
            <Link to="/">Home</Link>
            {/* <Link to="/videos">All Videos</Link> */}
            {/* <Link to="/categories/sermon">Sermons</Link> */}
            <Link to="/categories/events">Events</Link>
          </nav>

          <div className="public-auth">
            {!authed ? (
              <>
                <button
                  className="login-btn"
                  onClick={() => setShowLogin(true)}
                >
                  Login
                </button>
                <button
                  className="signup-btn"
                  onClick={() => setShowSignup(true)}
                >
                  Sign Up
                </button>
                <Link to="/subscribe" className="signup-btn">
                  Subscribe
                </Link>
              </>
            ) : (
              <>
                <Link to="/account" className="login-btn">
                  Account
                </Link>
                <button className="signup-btn" onClick={logout}>
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {showSignup && <SignupModal onClose={() => setShowSignup(false)} />}
    </>
  );
}
