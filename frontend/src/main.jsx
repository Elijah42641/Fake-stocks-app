import React, { useState, useRef } from "react";
import { createRoot } from "react-dom/client";

function StockPrompt({ isOpen, onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(100);
  const [previewImage, setPreviewImage] = useState("");
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = ["image/png", "image/jpeg", "image/jpg"];
      if (!validTypes.includes(file.type)) {
        alert("Please upload a PNG, JPG, or JPEG file");
        fileInputRef.current.value = ""; // Clear invalid file
        return;
      }

      // Validate file size (2MB max)
      if (file.size > 2 * 1024 * 1024) {
        alert("File size must be less than 2MB");
        fileInputRef.current.value = ""; // Clear oversized file
        return;
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("name", name);
    formData.append("symbol", symbol);
    formData.append("description", description);
    formData.append("price", price);

    // Get file from input ref
    if (fileInputRef.current.files[0]) {
      formData.append("tickerImage", fileInputRef.current.files[0]);
    }

    onSubmit(formData);
    onClose();
  };

  const handleRemoveImage = () => {
    setPreviewImage("");
    fileInputRef.current.value = ""; // Proper way to clear file input
  };

  if (!isOpen) return null;

  return (
    <div className="prompt-overlay">
      <div className="cyberpunk-prompt">
        <div className="cyberpunk-header">
          <h2 className="neon-text">CREATE NEW STOCK</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="neon-label">STOCK NAME</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="cyberpunk-input"
              required
              maxLength={20}
            />
          </div>

          <div className="input-group">
            <label className="neon-label">STOCK SYMBOL (2-4 chars)</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="cyberpunk-input"
              required
              minLength={2}
              maxLength={4}
            />
          </div>

          <div className="input-group">
            <label className="neon-label">STOCK SYMBOL IMAGE</label>
            <p className="file-instructions">
              Please upload a .png, .jpg, or .jpeg file (max 2MB)
            </p>
            <input
              type="file"
              accept=".png,.jpg,.jpeg"
              onChange={handleImageUpload}
              className="cyberpunk-input"
              required
              ref={fileInputRef}
            />
            {previewImage && (
              <div className="image-preview">
                <img
                  src={previewImage}
                  alt="Ticker preview"
                  style={{
                    maxWidth: "100px",
                    maxHeight: "100px",
                    marginTop: "10px",
                    border: "1px solid var(--neon-blue)",
                  }}
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="cyberpunk-btn cancel"
                  style={{ marginTop: "5px" }}
                >
                  Remove Image
                </button>
              </div>
            )}
          </div>

          <div className="input-group">
            <label className="neon-label">DESCRIPTION</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="cyberpunk-textarea"
              required
              maxLength={200}
            />
          </div>

          <div className="input-group">
            <label className="neon-label">STARTING PRICE: ${price}</label>
            <input
              type="range"
              min="1"
              max="500"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="cyberpunk-slider"
            />
            <div className="price-range">
              <span>$1</span>
              <span>$500</span>
            </div>
          </div>

          <div className="button-group">
            <button
              type="button"
              className="cyberpunk-btn cancel"
              onClick={onClose}
            >
              CANCEL
            </button>
            <button type="submit" className="cyberpunk-btn submit">
              LAUNCH STOCK
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HTMLforReact() {
  const [showPrompt, setShowPrompt] = useState(false);

  const handleCreateStock = (stockData) => {
    console.log("New stock created:", stockData);
    setShowPrompt(false);
  };

  return (
    <>
      <nav className="navbar">
        <div className="logo">
          NEON<span>TRADER</span>
        </div>
        <div className="nav-links">
          <a href="/dashboard/dashboard.html" className="nav-link active">
            Dashboard
          </a>
          <a href="/market/market.html" className="nav-link">
            Market
          </a>
          <a
            href="/portfolio/portfolio.html"
            className="nav-link"
            style={{ color: "var(--neon-blue)" }}
          >
            My Portfolio
          </a>
          <a href="/profile/profile.html" className="nav-link">
            Profile
          </a>
        </div>
      </nav>

      <div className="container">
        <div className="page-header">
          <h1 className="page-title">MY CREATED STOCKS</h1>
          <button onClick={() => setShowPrompt(true)} className="create-btn">
            + Create New Stock
          </button>
        </div>

        <div className="stock-grid">
          {/* Featured Stock Card */}
          <div className="stock-card featured">
            <div className="card-header">
              <div className="card-logo">PP</div>
              <div className="card-info">
                <div className="card-name">
                  PetPals <span className="card-symbol">PP</span>
                </div>
                <p className="card-description">
                  Next-gen pet care technology with AI-powered health monitoring
                  for your furry friends.
                </p>
              </div>
            </div>

            <div className="price-section">
              <div className="price-info">
                <span className="price-label">Current Price</span>
                <div className="card-price">$45.75</div>
              </div>
              <div className="price-change">
                <span className="change-label">24h Change</span>
                <div className="card-change positive">▲ 8.2%</div>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-label">Total Volume</div>
                <div className="stat-value">12,400</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Market Cap</div>
                <div className="stat-value">$1.2M</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Owners</div>
                <div className="stat-value">84</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Your Shares</div>
                <div className="stat-value">500 (25%)</div>
              </div>
            </div>

            <div className="activity-section">
              <h3 className="section-title">⚡ Recent Activity</h3>
              <ul className="activity-list">
                <li className="activity-item">
                  <div className="activity-info">
                    <span className="activity-type">
                      User "CryptoWolf" bought 50 shares
                    </span>
                    <span className="activity-time">2 hours ago</span>
                  </div>
                  <span className="activity-amount positive">+$2,287.50</span>
                </li>
                <li className="activity-item">
                  <div className="activity-info">
                    <span className="activity-type">
                      Price increased by 3.2%
                    </span>
                    <span className="activity-time">5 hours ago</span>
                  </div>
                  <span className="activity-amount positive">▲</span>
                </li>
                <li className="activity-item">
                  <div className="activity-info">
                    <span className="activity-type">
                      User "DayTrader" sold 20 shares
                    </span>
                    <span className="activity-time">Yesterday</span>
                  </div>
                  <span className="activity-amount negative">-$915.00</span>
                </li>
              </ul>
            </div>

            <div className="card-actions">
              <button className="action-btn edit-btn">✏️ Edit</button>
              <button className="action-btn stats-btn">
                📊 Detailed Stats
              </button>
              <button className="action-btn promote-btn">🚀 Promote</button>
            </div>
          </div>

          {/* Regular Stock Card */}
          <div className="stock-card">
            <div className="card-header">
              <div className="card-logo">ER</div>
              <div className="card-info">
                <div className="card-name">
                  EcoRide <span className="card-symbol">ER</span>
                </div>
                <p className="card-description">
                  Electric bike sharing network with solar-powered charging
                  stations in urban areas.
                </p>
              </div>
            </div>

            <div className="price-section">
              <div className="price-info">
                <span className="price-label">Current Price</span>
                <div className="card-price">$32.50</div>
              </div>
              <div className="price-change">
                <span className="change-label">24h Change</span>
                <div className="card-change negative">▼ 3.1%</div>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-label">Total Volume</div>
                <div className="stat-value">8,750</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Market Cap</div>
                <div className="stat-value">$875K</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Owners</div>
                <div className="stat-value">62</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Your Shares</div>
                <div className="stat-value">300 (15%)</div>
              </div>
            </div>

            <div className="activity-section">
              <h3 className="section-title">⚡ Recent Activity</h3>
              <ul className="activity-list">
                <li className="activity-item">
                  <div className="activity-info">
                    <span className="activity-type">
                      Price decreased by 1.5%
                    </span>
                    <span className="activity-time">4 hours ago</span>
                  </div>
                  <span className="activity-amount negative">▼</span>
                </li>
                <li className="activity-item">
                  <div className="activity-info">
                    <span className="activity-type">
                      User "EcoWarrior" bought 25 shares
                    </span>
                    <span className="activity-time">Yesterday</span>
                  </div>
                  <span className="activity-amount positive">+$812.50</span>
                </li>
                <li className="activity-item">
                  <div className="activity-info">
                    <span className="activity-type">
                      User "QuickCash" sold 40 shares
                    </span>
                    <span className="activity-time">2 days ago</span>
                  </div>
                  <span className="activity-amount negative">-$1,300.00</span>
                </li>
              </ul>
            </div>

            <div className="card-actions">
              <button className="action-btn edit-btn">✏️ Edit</button>
              <button className="action-btn stats-btn">
                📊 Detailed Stats
              </button>
              <button className="action-btn promote-btn">🚀 Promote</button>
            </div>
          </div>
        </div>
      </div>

      <StockPrompt
        isOpen={showPrompt}
        onClose={() => setShowPrompt(false)}
        onSubmit={handleCreateStock}
      />
    </>
  );
}

document.addEventListener("DOMContentLoaded", () => {
  const rootElement = document.getElementById("root");
  if (rootElement) {
    const root = createRoot(rootElement);
    root.render(<HTMLforReact />);
  } else {
    console.error("Root element not found");
  }
});

export default HTMLforReact;
