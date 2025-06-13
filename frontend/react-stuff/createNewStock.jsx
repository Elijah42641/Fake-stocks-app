import { useState } from "react";
import React from "react";

function CreateStockPrompt() {
  const [toggle, setToggle] = useState(0);

  function ToggleThing() {
    setToggle(!toggle);
  }

  if (toggle === 1) {
    document.body.innerHTML = "";
  } else {
    return undefined;
  }
}

document
  .getElementsByClassName("create-btn")[0]
  .addEventListener("click", () => {
    console.log("create new stock toggled");
    CreateStockPrompt();
  });

window.onload = () => {
  console.log("react file loaded");
};

export default CreateStockPrompt;
