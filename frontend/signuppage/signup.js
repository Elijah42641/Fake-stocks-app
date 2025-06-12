const usernameBox = document.getElementsByClassName("username")[0];
const passwordBox = document.getElementsByClassName("password")[0];
const signUpButton = document.getElementsByClassName("getstarted")[0];
const invalidUsername = document.getElementsByClassName("invalidUsername")[0];
const invalidPassword = document.getElementsByClassName("invalidPassword")[0];
const username = usernameBox.value;
const password=passwordBox.value;

axios.defaults.withCredentials = true;

const profanityList = [
  "ass","asshole","bastard","bitch","bloody","bollocks","brothel",
  "bugger", "cock", "crap", "cunt", "damn", "dick", "dildo", "dyke","fag", "faggot", "fuck", "fucker", "fucking", "goddamn", "hell", "homo", "jerk", "kike", "motherfucker", "nigga", "nigger", "piss", "prick", "pussy", "retard", "shit", "shitty", "slut", "spic","tard","twat","whore", "wank","wanker"
];

function usernameTooLong() {
  invalidUsername.textContent = "Username can't be over 22 characters";
}
function usernameTooShort() {
  invalidUsername.textContent = "Username can't be under 3 characters";
}
function usernameContainsProfanity() {
  invalidUsername.textContent = "Username can't contain profanity";
}
function goodPassCheck() {
  if (passwordBox.value.length < 8) {
    invalidPassword.textContent = "Password must be at least 8 characters";
    return false;
  } else if (passwordBox.value.length > 25) {
    invalidPassword.textContent = "Password can't be over 25 characters";
    return false;
  } else {
    invalidPassword.textContent = "";
    return true;
  }
}

async function checkCredsThenCreateAcc(username, password) {
try {
  const response = await axios.post('http://localhost:4000/api/createaccount', {
  username,
  password
}, {
  withCredentials: true 
});
window.location.href="../dashboard/dashboard.html";
}

  catch(err) {
    if(err.response.data?.code===1002) {
      invalidUsername.textContent="An account with this username already exists";
    }
    
    else if(err.response.data?.code===23505) {
      invalidUsername.textContent="Please try again: race error encountered ";
      checkCredsThenCreateAcc(username, password);
    }

    console.error(err);
  }
};

function checkAllValidations() {
  invalidUsername.textContent = "";
  invalidPassword.textContent = "";

  let isUsernameValid = true;
  let isPasswordValid = true;

  const username = usernameBox.value.trim();
  if (username.length > 22) {
    usernameTooLong();
    isUsernameValid = false;
  } else if (username.length < 3) {
    usernameTooShort();
    isUsernameValid = false;
  } else if (username.length<=22 && username.length>=3) {
    for (const profanity of profanityList) {
      if (username.toLowerCase().includes(profanity)) {
        usernameContainsProfanity();
        isUsernameValid = false;
        break;
      }
    }
  }


  isPasswordValid = goodPassCheck();

  return isUsernameValid && isPasswordValid;
}


signUpButton.addEventListener("click", async function (e) {
  e.preventDefault();

  invalidUsername.textContent = "";
  invalidPassword.textContent = "";

  if (!checkAllValidations()) return;

  const username = usernameBox.value.trim();
  const password = passwordBox.value.trim();
  checkCredsThenCreateAcc(username,password);
});