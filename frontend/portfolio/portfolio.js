console.log("portfolio.js linked");

async function checkUserSignedIn() {
  try {
    console.log("checking logged in");
    const response = await axios.post(
      "http://localhost:4000/api/usersignedin",
      {},
      {
        headers: {
          "Content-Type": "application/json",
        },
        withCredentials: true,
      }
    );
    console.log("user is signed in");
    if (response.status === 401) {
      window.location.href = "../signinpage/signin.html";
    }
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log("redirect");
      window.location.href = "../signinpage/signin.html";
    } else {
      console.error(error);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("portfolio.js loaded");
  checkUserSignedIn();
});

const ws = new WebSocket("ws://localhost:4000");

ws.addEventListener("open", (ws) => {
  console.log("client connected");
});

ws.addEventListener("close", (ws) => {
  console.log("client connected");
});

ws.addEventListener("error", (err) => {
  console.error("WebSocket error:", err);
});
