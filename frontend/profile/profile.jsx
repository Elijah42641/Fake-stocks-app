async function checkUserSignedIn() {
 try {
    const response = await axios.post('/api/usersignedin', {
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
       withCredentials:true
    }
  );
  console.log("page run without error");
  if (response.status===401) {
        window.location.href="../signinpage/signin.html";
  };
  } 

  catch (error) {
if(error.response.status===401) {
    console.log("redirect");
    window.location.href="../signinpage/signin.html";
}
else {
   console.error(error);
}
  }
}

window.onload=()=>  {
    console.log("page loaded");
    checkUserSignedIn();
}


const ws = new WebSocket("ws://localhost:4000");

ws.addEventListener("open", ws => {
  console.log("client connected");
});

ws.addEventListener("close", ws => {
  console.log("client connected");
});

ws.addEventListener("error", err => {
  console.error("WebSocket error:", err);
});