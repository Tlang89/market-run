<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Market Run</title>

<style>
body {
  background:#0e0e0e;
  color:#fff;
  font-family:Arial;
  text-align:center;
}

button {
  padding:12px;
  margin:5px;
  background:gold;
  border:none;
  border-radius:8px;
  font-weight:bold;
}

.hidden { display:none; }

.city {
  background:#1c1c1c;
  padding:10px;
  margin:5px;
  border-radius:10px;
}

canvas {
  background:#111;
  border-radius:10px;
  margin-top:10px;
}
</style>
</head>

<body>

<h1 style="color:gold;">Market Run</h1>

<!-- INTRO -->
<div id="intro">
<p>Travel city to city, read the market, and make real buy/sell decisions.</p>
<p>Trade <b>Food</b>, <b>Sneakers</b>, and <b>Electronics</b>.</p>
<p>Buy low, travel, sell high — or lose money.</p>
<p>The 🔵 shows your travel path.</p>

<button onclick="startGame()">Enter the Market</button>
</div>

<!-- GAME -->
<div id="game" class="hidden">

<h3 id="day">Day: 1</h3>
<h3 id="money">Money: $1000</h3>

<canvas id="map" width="300" height="200"></canvas>

<h2 id="cityName">City</h2>

<div id="prices"></div>

<h3>Inventory</h3>
<p id="inventory"></p>

<button onclick="buy('food')">Buy Food</button>
<button onclick="sell('food')">Sell Food</button><br>

<button onclick="buy('sneakers')">Buy Sneakers</button>
<button onclick="sell('sneakers')">Sell Sneakers</button><br>

<button onclick="buy('electronics')">Buy Electronics</button>
<button onclick="sell('electronics')">Sell Electronics</button>

<br><br>

<button onclick="travel()">Travel</button>

</div>

<script>
// GAME STATE
let money = 1000;
let day = 1;

let inventory = {
  food:0,
  sneakers:0,
  electronics:0
};

let cities = [
  {name:"Des Moines", x:50, y:100},
  {name:"Chicago", x:150, y:50},
  {name:"Denver", x:250, y:120}
];

let currentCity = 0;

let prices = {};

// START GAME
function startGame(){
  document.getElementById("intro").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");
  generatePrices();
  updateUI();
  drawMap();
}

// GENERATE MARKET
function generatePrices(){
  prices = {
    food: rand(5,20),
    sneakers: rand(50,200),
    electronics: rand(100,500)
  };
}

// RANDOM
function rand(min,max){
  return Math.floor(Math.random()*(max-min+1)+min);
}

// UPDATE UI
function updateUI(){
  document.getElementById("money").innerText = "Money: $" + money;
  document.getElementById("day").innerText = "Day: " + day;
  document.getElementById("cityName").innerText = cities[currentCity].name;

  document.getElementById("prices").innerHTML =
    "Food: $" + prices.food +
    " | Sneakers: $" + prices.sneakers +
    " | Electronics: $" + prices.electronics;

  document.getElementById("inventory").innerText =
    "Food: " + inventory.food +
    " | Sneakers: " + inventory.sneakers +
    " | Electronics: " + inventory.electronics;
}

// BUY
function buy(item){
  if(money >= prices[item]){
    money -= prices[item];
    inventory[item]++;
    updateUI();
  }
}

// SELL
function sell(item){
  if(inventory[item] > 0){
    money += prices[item];
    inventory[item]--;
    updateUI();
  }
}

// TRAVEL
function travel(){
  let oldCity = currentCity;
  currentCity = rand(0, cities.length-1);

  day++;
  generatePrices();
  updateUI();
  drawMap(oldCity, currentCity);
}

// MAP DRAW
function drawMap(from=null, to=null){
  let canvas = document.getElementById("map");
  let ctx = canvas.getContext("2d");

  ctx.clearRect(0,0,300,200);

  // draw cities
  cities.forEach((c,i)=>{
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(c.x,c.y,5,0,Math.PI*2);
    ctx.fill();

    ctx.fillText(c.name, c.x-20, c.y-10);
  });

  // draw travel line
  if(from !== null){
    ctx.strokeStyle = "blue";
    ctx.beginPath();
    ctx.moveTo(cities[from].x, cities[from].y);
    ctx.lineTo(cities[to].x, cities[to].y);
    ctx.stroke();

    // blue dot
    ctx.fillStyle = "blue";
    ctx.beginPath();
    ctx.arc(cities[to].x, cities[to].y,6,0,Math.PI*2);
    ctx.fill();
  }
}
</script>

</body>
</html>
