const username = document.getElementsByClassName("username")[0].value.trim();
const password = document.getElementsByClassName("password")[0].value.trim();

async function callTheSignInApi() {
  try {
    // Get and trim inputs
    const username = document.querySelector(".username").value.trim();
    const password = document.querySelector(".password").value.trim();
    
    // Validate
    if (!username || !password) {
      document.querySelector(".invalidUsername").textContent = "Please enter both fields";
      return;
    }

    const response = await axios.post('http://localhost:4000/api/signin', {
      username,
      password
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
       withCredentials:true
    }
  );

    // Redirect on success
    window.location.href="../dashboard/dashboard.html";
  } catch (error) {
    // Handle all error cases
    const errorElement = document.querySelector(".invalidUsername");
    
    if (error.response) {
      if (error.response.status === 400) {
        errorElement.textContent = "Invalid request format";
      } else if (error.response.status === 401) {
        errorElement.textContent = "Wrong username/password";
      }
    } else {
      errorElement.textContent = "Network error - check console";
      console.error("Signin failed:", error);
    }
  }
}

// Attach event listener
document.querySelector(".getstarted").addEventListener("click", (e) => {
  e.preventDefault();
  callTheSignInApi();
});

window.onload=()=>{
  console.log(navigator.cookieEnabled);
}