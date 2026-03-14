// Random Generator

// GenerateButton
// GenerateLabel

const GenerateButton = document.getElementById("GenerateButton");
const GenerateLabel = document.getElementById("GenerateLabel");
const min = 1;
const max = 6;
let randomNum;

GenerateButton.onclick = function(){
    randomNum = Math.floor(Math.random() * max) + min;
    GenerateLabel.textContent = randomNum;
}


// const min = 50;
// const max = 100;

// let randomNum = Math.floor(Math.random() * (max - min)) + min;

// console.log(randomNum);