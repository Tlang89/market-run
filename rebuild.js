(function marketRunRebuild() {
  const clampValue = (value, min, max) => Math.max(min, Math.min(max, value));
  const average = (values) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

  const catalog = items.map((item) => ({
    name: item.name,
    base: item.base,
    baseRisk: item.risk,
  }));

  const cityShort = {
    "New York": "New York",
    Chicago: "Chicago",
    Miami: "Miami",
    "Los Angeles": "Los Angeles",
    Atlanta: "Atlanta",
  };

  cityBg["New York"] = "New York Street.png";
  cityBg.Chicago = "chicago_street.png";
  cityBg.Miami = "miami_neon.png";
  cityBg["Los Angeles"] = "la_sunset.png";
  cityBg.Atlanta = "atlanta_street.png";

  cities.forEach((cityName) => {
    storageBg[cityName] = cityBg[cityName];
  });

  sceneBg.travel = "New York Alley.png";
  sceneBg.police = "New York Alley.png";
  sceneBg.hospital = "New York Street.png";
  ASSETS.comedian = "The Comedian.png";

  let lastEventDay = -99;
  let lastEventRollDay = -99;

  function marketAnchor(cityName, itemName) {
    const entry = catalog.find((item) => item.name === itemName);
    const bias = cityBias[cityName]?.[itemName] || 1;
    return Math.max(25, Math.round((entry?.base || 100) * bias));
  }

  function createMarketState(cityName, entry) {
    const anchor = marketAnchor(cityName, entry.name);
    const history = [];
    let price = anchor * (0.95 + Math.random() * 0.1);
    let momentum = (Math.random() - 0.5) * (0.008 + entry.baseRisk * 0.004);

    for (let index = 0; index < 10; index += 1) {
      const noise = (Math.random() - 0.5) * (0.012 + entry.baseRisk * 0.004);
      price = Math.max(25, price * (1 + momentum + noise));
      history.push(Math.round(price));
      momentum = momentum * 0.72 + (Math.random() - 0.5) * 0.008;
    }

    return {
      price: history[history.length - 1],
      last: history[history.length - 2],
      history,
      momentum,
    };
  }

  function normalizeState(cityName, entry, input) {
    const fresh = createMarketState(cityName, entry);
    if (!input || typeof input !== "object") return fresh;

    const history = Array.isArray(input.history)
      ? input.history
          .map((value) => Math.max(25, Math.round(Number(value) || 0)))
          .filter(Boolean)
          .slice(-10)
      : [];

    while (history.length < 4) history.unshift(fresh.history[history.length] || fresh.price);

    const price = Math.max(
      25,
      Math.round(Number(input.price) || history[history.length - 1] || fresh.price),
    );
    history[history.length - 1] = price;

    return {
      price,
      last: Math.max(
        25,
        Math.round(Number(input.last) || history[history.length - 2] || price),
      ),
      history,
      momentum: clampValue(Number(input.momentum) || 0, -0.12, 0.12),
    };
  }

  function hydrateLedger(input) {
    const ledger = {};
    cities.forEach((cityName) => {
      ledger[cityName] = {};
      catalog.forEach((entry) => {
        ledger[cityName][entry.name] = normalizeState(
          cityName,
          entry,
          input?.[cityName]?.[entry.name],
        );
      });
    });
    return ledger;
  }

  let marketLedger = hydrateLedger(null);

  function analyticsFromHistory(history) {
    const values = history.map(Number).filter(Number.isFinite);
    if (values.length < 2) {
      return {
        risk: 1,
        label: "Stable",
        className: "flat",
        direction: 0,
        periodPct: 0,
        dayPct: 0,
        low: values[0] || 0,
        high: values[0] || 0,
      };
    }

    const returns = [];
    for (let index = 1; index < values.length; index += 1) {
      const previous = Math.max(1, values[index - 1]);
      returns.push(((values[index] - previous) / previous) * 100);
    }

    const recentValues = values.slice(-4);
    const recentReturns = [];
    for (let index = 1; index < recentValues.length; index += 1) {
      const previous = Math.max(1, recentValues[index - 1]);
      recentReturns.push(((recentValues[index] - previous) / previous) * 100);
    }

    const low = Math.min(...values);
    const high = Math.max(...values);
    const rangePct = ((high - low) / Math.max(1, average(values))) * 100;
    const averageSwing = average(returns.map((value) => Math.abs(value)));
    const risk = clampValue(Math.round(1 + averageSwing / 2.6 + rangePct / 17), 1, 5);
    const periodPct =
      ((values[values.length - 1] - recentValues[0]) / Math.max(1, recentValues[0])) * 100;
    const dayPct = returns[returns.length - 1] || 0;
    const upSteps = recentReturns.filter((value) => value > 0.45).length;
    const downSteps = recentReturns.filter((value) => value < -0.45).length;
    const flatSteps = recentReturns.length - upSteps - downSteps;

    if (upSteps === recentReturns.length && periodPct >= 9) {
      return { risk, label: "Surging", className: "up", direction: 2, periodPct, dayPct, low, high };
    }
    if (upSteps >= 2 && downSteps === 0 && periodPct >= 2) {
      return { risk, label: "Rising", className: "up", direction: 1, periodPct, dayPct, low, high };
    }
    if (downSteps === recentReturns.length && periodPct <= -9) {
      return { risk, label: "Crash", className: "down", direction: -2, periodPct, dayPct, low, high };
    }
    if (downSteps >= 2 && upSteps === 0 && periodPct <= -2) {
      return { risk, label: "Falling", className: "down", direction: -1, periodPct, dayPct, low, high };
    }
    if (risk >= 4) {
      return { risk, label: "Volatile", className: "down", direction: 0, periodPct, dayPct, low, high };
    }
    if (risk === 3 || (upSteps > 0 && downSteps > 0)) {
      return { risk, label: "Choppy", className: "flat", direction: 0, periodPct, dayPct, low, high };
    }
    if (flatSteps >= 2 || Math.abs(periodPct) < 2) {
      return { risk, label: "Stable", className: "flat", direction: 0, periodPct, dayPct, low, high };
    }
    return { risk, label: "Mixed", className: "flat", direction: 0, periodPct, dayPct, low, high };
  }

  function currentState(itemName) {
    return marketLedger[city]?.[itemName];
  }

  function syncCurrentMarket() {
    items.forEach((item) => {
      const state = currentState(item.name);
      if (!state) return;
      const analytics = analyticsFromHistory(state.history);
      item.price = state.price;
      item.last = state.last;
      item.history = state.history;
      item.trend = analytics.direction;
      item.risk = analytics.risk;
    });
  }

  function advanceAllMarkets() {
    cities.forEach((cityName) => {
      catalog.forEach((entry) => {
        const state = marketLedger[cityName][entry.name];
        const anchor = marketAnchor(cityName, entry.name);
        const baseNoise = 0.012 + entry.baseRisk * 0.0065;
        const meanReversion = ((anchor - state.price) / Math.max(1, anchor)) * 0.045;
        const momentumNoise = (Math.random() - 0.5) * (0.008 + entry.baseRisk * 0.004);

        state.momentum = clampValue(state.momentum * 0.68 + momentumNoise, -0.09, 0.09);

        let shock = 0;
        const shockChance = 0.012 + entry.baseRisk * 0.007;
        if (Math.random() < shockChance) {
          shock = (Math.random() < 0.5 ? -1 : 1) * (0.035 + Math.random() * entry.baseRisk * 0.021);
        }

        const noise = (Math.random() - 0.5) * baseNoise;
        const move = clampValue(state.momentum + meanReversion + noise + shock, -0.24, 0.24);

        state.last = state.price;
        state.price = Math.max(25, Math.round(state.price * (1 + move)));
        state.history.push(state.price);
        if (state.history.length > 10) state.history.shift();
      });
    });
    syncCurrentMarket();
  }

  function signedPercent(value) {
    if (Math.abs(value) < 0.05) return "0.0%";
    return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
  }

  function riskTicks(risk) {
    return `<span class="riskTicks" aria-hidden="true">${Array.from(
      { length: 5 },
      (_, index) => `<i class="${index < risk ? "on" : ""}"></i>`,
    ).join("")}</span>`;
  }

  trendLabel = function rebuiltTrendLabel(item) {
    const analytics = analyticsFromHistory(item.history);
    return `<span class="${analytics.className}">${analytics.label}</span>`;
  };

  spark = function rebuiltSpark(item) {
    const values = item.history.map(Number);
    const analytics = analyticsFromHistory(values);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(1, max - min);
    const width = 320;
    const height = 76;
    const padX = 8;
    const padY = 8;
    const plotWidth = width - padX * 2;
    const plotHeight = height - padY * 2;
    const points = values.map((value, index) => {
      const x = padX + index * (plotWidth / Math.max(1, values.length - 1));
      const y = padY + plotHeight - ((value - min) / range) * plotHeight;
      return { x, y, value };
    });
    const color =
      analytics.className === "up"
        ? "#78e39a"
        : analytics.className === "down"
          ? "#ff7474"
          : "#d4af37";
    const recent = values.slice(-4).map((value) => money(value)).join(" → ");
    const dayClass = analytics.dayPct > 0.05 ? "up" : analytics.dayPct < -0.05 ? "down" : "flat";

    return `
      <div class="chartBlock">
        <div class="chartMeta"><span>10-day tape</span><span>Low ${money(min)} · High ${money(max)}</span></div>
        <svg class="spark" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${item.name} recent price chart">
          <title>${item.name}: ${values.map((value) => money(value)).join(", ")}</title>
          <line x1="${padX}" y1="18" x2="${width - padX}" y2="18" stroke="rgba(212,175,55,.11)" />
          <line x1="${padX}" y1="38" x2="${width - padX}" y2="38" stroke="rgba(212,175,55,.11)" />
          <line x1="${padX}" y1="58" x2="${width - padX}" y2="58" stroke="rgba(212,175,55,.11)" />
          <polyline points="${points.map((point) => `${point.x},${point.y}`).join(" ")}" fill="none" stroke="${color}" stroke-width="3" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" />
          ${points
            .map(
              (point, index) =>
                `<circle cx="${point.x}" cy="${point.y}" r="${index === points.length - 1 ? 3.8 : 2.2}" fill="${color}"><title>${money(point.value)}</title></circle>`,
            )
            .join("")}
        </svg>
        <div class="chartFooter"><span>Oldest → newest</span><span class="dayChange ${dayClass}">Today ${signedPercent(analytics.dayPct)}</span></div>
        <div class="recentPrices"><b>Last four:</b> ${recent}</div>
      </div>`;
  };

  renderMarket = function rebuiltRenderMarket() {
    syncCurrentMarket();
    const marketHead = document.querySelector(".marketHead");
    const marketElement = document.getElementById("market");

    if (marketHead) {
      marketHead.innerHTML = `
        <div class="marketHeadTitle">
          <strong>Black Market</strong>
          <small>One model drives price, trend, risk & chart</small>
        </div>
        <div class="marketHeadActions">
          <span class="cityChip">${city}</span>
          <button class="hubButton" onclick="showPriceHub()">CITY PRICE BOARD</button>
        </div>`;
    }

    if (!marketElement) return;
    marketElement.innerHTML = items
      .map((item, index) => {
        const analytics = analyticsFromHistory(item.history);
        const changeClass =
          analytics.dayPct > 0.05 ? "up" : analytics.dayPct < -0.05 ? "down" : "flat";
        return `
          <article class="itemCard">
            <div class="itemTop">
              <div>
                <div class="itemName">${item.name}</div>
                <div class="metaRow">
                  <span class="riskBadge risk-${analytics.risk}" title="Risk is calculated from recent price swings">Risk ${analytics.risk}/5 ${riskTicks(analytics.risk)}</span>
                  <span class="trendBadge ${analytics.className}">${analytics.label}</span>
                </div>
              </div>
              <div>
                <div class="price">${money(item.price)}</div>
                <div class="dayChange ${changeClass}">${signedPercent(analytics.dayPct)} today</div>
              </div>
            </div>
            ${spark(item)}
            <div class="buttons">
              <button class="btnGold" onclick="buyItem(${index})" aria-label="Buy one ${item.name}">Buy</button>
              <button onclick="sellItem(${index})" aria-label="Sell one ${item.name}">Sell</button>
            </div>
          </article>`;
      })
      .join("");

    const wrapper = document.getElementById("marketWrap");
    if (wrapper) {
      wrapper.classList.add("marketPulse");
      setTimeout(() => wrapper.classList.remove("marketPulse"), 320);
    }
  };

  function conditionLabel() {
    if (health >= 80) return "Ready";
    if (health >= 55) return "Bruised";
    if (health >= 30) return "Hurt";
    return "Critical";
  }

  function effectiveCarryLimit() {
    if (health < 25) return Math.max(10, carryLimit - 10);
    if (health < 50) return Math.max(10, carryLimit - 5);
    return carryLimit;
  }

  renderHud = function rebuiltRenderHud() {
    const hudElement = document.getElementById("hud");
    if (!hudElement) return;
    const capacityPenalty = carryLimit - effectiveCarryLimit();
    hudElement.innerHTML = `
      <div class="hudCard"><div class="label">City</div><div class="value">${city}</div><div class="subValue">Local trading only</div></div>
      <div class="hudCard"><div class="label">Cash</div><div class="value">${money(cash)}</div><div class="subValue">Spendable now</div></div>
      <div class="hudCard"><div class="label">Bank</div><div class="value">${money(bank)}</div><div class="subValue">Protected funds</div></div>
      <div class="hudCard"><div class="label">Condition</div><div class="value">${health}% · ${conditionLabel()}</div><div class="meter conditionMeter"><span style="width:${clampValue(health, 0, 100)}%"></span></div><div class="subValue">${capacityPenalty ? `Carry limit −${capacityPenalty}` : "Full carrying strength"}</div></div>
      <div class="hudCard"><div class="label">Heat</div><div class="value">${heatText()}</div><div class="meter heatMeter"><span style="width:${clampValue((heat / 130) * 100, 0, 100)}%"></span></div><div class="subValue">${Math.round(heat)}/130 pressure</div></div>
      <div class="hudCard"><div class="label">Time / Blocks</div><div class="value">Y${yearNow()} D${dayOfYear()}</div><div class="subValue">${blocksOwned}/5 blocks · ${effectiveCarryLimit()} capacity</div></div>`;
  };

  const legacyRenderInv = renderInv;
  renderInv = function rebuiltRenderInventory() {
    legacyRenderInv();
    const capacity = document.getElementById("cap");
    if (capacity) {
      capacity.textContent = `${carrying}/${effectiveCarryLimit()}`;
      if (effectiveCarryLimit() < carryLimit) {
        capacity.title = "Low condition temporarily reduces carrying capacity";
      }
    }
  };

  generateIntel = function rebuiltIntel() {
    let best = null;
    catalog.forEach((entry) => {
      const prices = cities.map((cityName) => ({
        city: cityName,
        price: marketLedger[cityName][entry.name].price,
      }));
      const low = prices.reduce((choice, value) => (value.price < choice.price ? value : choice));
      const high = prices.reduce((choice, value) => (value.price > choice.price ? value : choice));
      const spread = ((high.price - low.price) / Math.max(1, low.price)) * 100;
      if (!best || spread > best.spread) best = { entry, low, high, spread };
    });

    if (!best) return;
    setIntel(
      `${best.entry.name}: ${best.low.city} is cheapest at ${money(best.low.price)}; ${best.high.city} pays ${money(best.high.price)} (${best.spread.toFixed(0)}% route spread).`,
    );
  };

  refreshPrices = function rebuiltRefreshPrices() {
    advanceAllMarkets();
    if (Math.random() < 0.58) generateIntel();
  };

  buyItem = function rebuiltBuyItem(index) {
    if (gameEnded) return;
    clickSound();
    const item = items[index];
    carrying = goodsCount(inventory);
    if (carrying >= effectiveCarryLimit()) {
      log(
        health < 50
          ? "Your condition is cutting into carrying capacity. Recover or sell something."
          : "Too much on you.",
        "bad",
      );
      return;
    }
    if (cash >= item.price) {
      cash -= item.price;
      inventory[item.name] = (inventory[item.name] || 0) + 1;
      log(`Bought ${item.name} at ${money(item.price)} in ${city}.`, "good");
      if (item.name === "Million Dollar Mixtape" && Math.random() < 0.08) mixtapeLegend();
    } else {
      log("Not enough cash.", "bad");
    }
    renderAll();
  };

  sellItem = function rebuiltSellItem(index) {
    if (gameEnded) return;
    clickSound();
    const item = items[index];
    if ((inventory[item.name] || 0) > 0) {
      inventory[item.name] -= 1;
      if (inventory[item.name] === 0) delete inventory[item.name];
      cash += item.price;
      cashSound();
      log(`Sold ${item.name} at ${money(item.price)} in ${city}.`, "good");
    } else {
      log(`No ${item.name}.`, "bad");
    }
    renderAll();
  };

  agePressure = function rebuiltAgePressure() {
    // Condition now represents actual injury. Time passing by itself does not cause random damage.
  };

  stay = function rebuiltStay() {
    if (gameEnded) return;
    clickSound();
    day += 1;
    heat = Math.max(0, heat - rand(0, 3));
    refreshPrices();
    log(`Stayed in ${city}. Markets moved one day.`, "info");
    const previousDonnieWeek = lastDonnieWeek;
    maybeDonnieWeekly();
    if (lastDonnieWeek === previousDonnieWeek) maybeEvent(0.13);
    brokeCheck("stay");
    renderAll();
  };

  function strongestCityEdge(cityName) {
    let choice = null;
    catalog.forEach((entry) => {
      const local = marketLedger[cityName][entry.name].price;
      const network = average(cities.map((name) => marketLedger[name][entry.name].price));
      const delta = ((local - network) / Math.max(1, network)) * 100;
      if (!choice || Math.abs(delta) > Math.abs(choice.delta)) choice = { entry, delta };
    });
    if (!choice) return "No clear edge";
    return `${choice.entry.name} ${Math.abs(choice.delta).toFixed(0)}% ${choice.delta < 0 ? "below" : "above"} network`;
  }

  showTravel = function rebuiltTravelMenu() {
    if (gameEnded) return;
    clickSound();
    const choices = cities
      .map(
        (cityName) => `
          <button class="travelChoice ${cityName === city ? "current" : ""}" ${cityName === city ? "disabled" : `onclick="travel('${cityName}')"`}>
            <strong>${cityName}${cityName === city ? " · CURRENT" : ""}</strong>
            <small>${strongestCityEdge(cityName)}</small>
          </button>`,
      )
      .join("");
    showPanel(
      "TRAVEL DESK",
      "",
      `<div class="conditionExplainer">Travel advances one day and adds a little heat. Check the city board before moving; you can inspect every price without traveling.</div><div class="travelGrid">${choices}</div>`,
      `<button onclick="showPriceHub()">Open City Price Board</button><button onclick="closePanel()">Cancel</button>`,
      "Choose Your Route",
    );
  };

  travel = function rebuiltTravel(next) {
    if (gameEnded || !cities.includes(next) || next === city) {
      closePanel();
      return;
    }
    clickSound();
    travelSound();
    const oldCity = city;
    showPanel("LEAVING " + oldCity, cityBg[oldCity], "One day passes while every city market keeps moving.", "", "Travel");

    setTimeout(() => {
      city = next;
      day += 1;
      heat += rand(2, 7);
      refreshPrices();
      log(`Traveled from ${oldCity} to ${city}.`, "info");
      renderAll();
      if (gameEnded) return;
      showPanel(
        "ARRIVED IN " + city,
        cityBg[city],
        `Fresh local prices are live. ${strongestCityEdge(city)}.`,
        `<button onclick="finishTravelArrival()">Step In</button><button onclick="showPriceHub()">Check Price Board</button>`,
        "Arrival",
      );
    }, 650);
  };

  function finishTravelArrival() {
    closePanel();
    const previousDonnieWeek = lastDonnieWeek;
    maybeDonnieWeekly();
    if (lastDonnieWeek === previousDonnieWeek) maybeEvent(0.2);
    brokeCheck("travel");
    renderAll();
  }

  function priceBoardHtml() {
    let bestRoute = null;
    const rows = catalog
      .map((entry) => {
        const values = cities.map((cityName) => ({
          city: cityName,
          price: marketLedger[cityName][entry.name].price,
        }));
        const min = Math.min(...values.map((value) => value.price));
        const max = Math.max(...values.map((value) => value.price));
        const buyCity = values.find((value) => value.price === min)?.city;
        const sellCity = values.find((value) => value.price === max)?.city;
        const profit = max - min;
        const spread = (profit / Math.max(1, min)) * 100;
        if (!bestRoute || spread > bestRoute.spread) {
          bestRoute = { entry, buyCity, sellCity, min, max, profit, spread };
        }

        return `<tr>
          <td>${entry.name}</td>
          ${values
            .map((value) => {
              const className = value.price === min ? "bestBuy" : value.price === max ? "bestSell" : "";
              return `<td class="${className}" title="${value.city}: ${money(value.price)}">${money(value.price)}</td>`;
            })
            .join("")}
        </tr>`;
      })
      .join("");

    const route = bestRoute
      ? `<div class="routeCallout"><b>Widest current spread:</b> Buy ${bestRoute.entry.name} in ${bestRoute.buyCity} for ${money(bestRoute.min)}, then sell in ${bestRoute.sellCity} for ${money(bestRoute.max)} — ${money(bestRoute.profit)} gross per unit (${bestRoute.spread.toFixed(0)}%).</div>`
      : "";

    return `${route}
      <div class="hubLegend"><span class="buyKey">Lowest city price</span><span class="sellKey">Highest city price</span></div>
      <div class="priceBoardWrap">
        <table class="priceBoard">
          <thead><tr><th>Goods</th>${cities.map((cityName) => `<th>${cityShort[cityName]}</th>`).join("")}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="conditionExplainer">The board is live and updates whenever a day passes. It is view-only: buying and selling still happen in your current city, ${city}.</div>`;
  }

  function showPriceHub() {
    if (gameEnded) return;
    clickSound();
    showPanel(
      "CITY PRICE BOARD",
      "",
      priceBoardHtml(),
      `<button onclick="closePanel()">Back to ${city}</button><button onclick="showTravel()">Plan Travel</button>`,
      "Trading Hub · All Cities",
    );
  }

  function recoveryCosts() {
    const missing = Math.max(0, 100 - health);
    return {
      clinic: Math.max(250, missing * 18),
      hospital: Math.max(650, missing * 38),
    };
  }

  hospital = function rebuiltRecoveryMenu() {
    if (gameEnded) return;
    clickSound();
    const costs = recoveryCosts();
    const penalty = carryLimit - effectiveCarryLimit();
    showPanel(
      "RECOVERY",
      "",
      `<div class="conditionExplainer"><b>Condition is injury, not a random timer.</b> Robberies, fights, police chases, and bad encounters can hurt you. Time passing alone no longer drains condition. ${penalty ? `Your injuries currently reduce carrying capacity by ${penalty}.` : "You have no carrying penalty."}</div>
       <div class="recoveryGrid">
         <button class="recoveryChoice" onclick="recoverLayLow()"><strong>Lay Low · Free</strong><small>One safe day. +8 condition and −12 heat. Markets still move.</small></button>
         <button class="recoveryChoice" onclick="recoverClinic()" ${health >= 100 ? "disabled" : ""}><strong>Street Clinic · ${money(costs.clinic)}</strong><small>One safe day. Restore up to 35 condition and reduce heat by 5.</small></button>
         <button class="recoveryChoice" onclick="recoverHospital()" ${health >= 100 ? "disabled" : ""}><strong>Hospital · ${money(costs.hospital)}</strong><small>One safe day. Full recovery and reduce heat by 8.</small></button>
       </div>`,
      `<button onclick="closePanel()">Cancel</button>`,
      `${health}% Condition · ${conditionLabel()}`,
    );
  };

  function finishRecovery(message) {
    closePanel();
    day += 1;
    refreshPrices();
    log(message, "good");
    renderAll();
    maybeDonnieWeekly();
  }

  function recoverLayLow() {
    health = Math.min(100, health + 8);
    heat = Math.max(0, heat - 12);
    finishRecovery("Laid low for a day. Condition improved and heat cooled.");
  }

  function recoverClinic() {
    const cost = recoveryCosts().clinic;
    if (health >= 100) return;
    if (cash < cost) {
      log(`Street clinic costs ${money(cost)}. Not enough cash.`, "bad");
      hospital();
      return;
    }
    cash -= cost;
    health = Math.min(100, health + 35);
    heat = Math.max(0, heat - 5);
    hospitalSound();
    finishRecovery(`Street clinic restored condition for ${money(cost)}.`);
  }

  function recoverHospital() {
    const cost = recoveryCosts().hospital;
    if (health >= 100) return;
    if (cash < cost) {
      log(`Hospital costs ${money(cost)}. Not enough cash.`, "bad");
      hospital();
      return;
    }
    cash -= cost;
    health = 100;
    heat = Math.max(0, heat - 8);
    hospitalSound();
    finishRecovery(`Hospital fully restored condition for ${money(cost)}.`);
  }

  maybeEvent = function rebuiltEventRoll(chance) {
    if (gameEnded || lastEventRollDay === day) return;
    lastEventRollDay = day;

    const now = Date.now();
    if (day - lastEventDay < 3 || now - lastEvent < 12000) return;

    const heatBonus = heat >= 95 ? 0.04 : heat >= 70 ? 0.02 : 0;
    const protection = Math.min(0.035, blocksOwned * 0.007);
    const finalChance = clampValue(Number(chance || 0.12) + heatBonus - protection, 0.06, 0.23);
    if (Math.random() > finalChance) return;

    lastEvent = now;
    lastEventDay = day;
    const roll = Math.random();

    if (roll < 0.21) showTonie();
    else if (roll < 0.27) showComedian();
    else if (roll < 0.44) policeEvent();
    else if (roll < 0.6) robberyEvent();
    else if (roll < 0.71) showRico();
    else if (roll < 0.81) showEddy();
    else if (roll < 0.92) showCake();
    else showPerrkey();
  };

  saveGame = function rebuiltSaveGame(manual = false) {
    if (gameEnded) return;
    const screen = document.getElementById("startScreen");
    if (screen && screen.style.display !== "none" && !manual) return;

    const save = {
      rebuildVersion: 2,
      cash,
      bank,
      day,
      city,
      health,
      heat,
      blocksOwned,
      inventory,
      storage,
      carryLimit,
      brokeTravelCount,
      lastDonnieWeek,
      donnieRespect,
      legacyWinSeen,
      empireWinSeen,
      lastHeatSaveDay,
      lastEventDay,
      lastEventRollDay,
      marketLedger,
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    if (manual) log("Game saved.", "good");
  };

  loadGame = function rebuiltLoadGame() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;

    try {
      const save = JSON.parse(raw);
      cash = Number(save.cash ?? cash);
      bank = Number(save.bank ?? bank);
      day = Number(save.day ?? day);
      city = cities.includes(save.city) ? save.city : city;
      health = clampValue(Number(save.health ?? health), 0, 100);
      heat = Math.max(0, Number(save.heat ?? heat));
      blocksOwned = Number(save.blocksOwned ?? blocksOwned);
      inventory = save.inventory || {};
      storage = save.storage || {};
      carryLimit = Number(save.carryLimit ?? carryLimit);
      brokeTravelCount = Number(save.brokeTravelCount ?? 0);
      lastDonnieWeek = Number(save.lastDonnieWeek ?? 0);
      donnieRespect = Number(save.donnieRespect ?? 0);
      legacyWinSeen = Boolean(save.legacyWinSeen);
      empireWinSeen = Boolean(save.empireWinSeen);
      lastHeatSaveDay = Number(save.lastHeatSaveDay ?? -99);
      lastEventDay = Number(save.lastEventDay ?? -99);
      lastEventRollDay = Number(save.lastEventRollDay ?? -99);
      marketLedger = hydrateLedger(save.marketLedger);

      if (!save.marketLedger && Array.isArray(save.items)) {
        save.items.forEach((savedItem) => {
          const entry = marketLedger[city]?.[savedItem.name];
          if (!entry) return;
          entry.price = Math.max(25, Number(savedItem.price) || entry.price);
          entry.last = Math.max(25, Number(savedItem.last) || entry.last);
          if (Array.isArray(savedItem.history) && savedItem.history.length) {
            entry.history = savedItem.history.map(Number).filter(Number.isFinite).slice(-10);
          }
          entry.momentum = clampValue(Number(savedItem.trend || 0) * 0.012, -0.08, 0.08);
        });
      }

      syncCurrentMarket();
      log("Saved run loaded into the rebuilt market.", "good");
      return true;
    } catch {
      clearSavedGame();
      return false;
    }
  };

  const legacyClosePanel = closePanel;
  closePanel = function rebuiltClosePanel() {
    legacyClosePanel();
    document.body.classList.remove("modalOpen");
  };

  showPanel = function rebuiltShowPanel(title, img, text, buttons, tag = "Comic Event") {
    closePanel();
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", title);
    overlay.innerHTML = `<div class="comic"><div class="comicTag">${tag}</div>${img ? `<img src="${img}" alt="" onerror="this.classList.add('broken')">` : ""}<div class="comicTitle">${title}</div><div class="comicText">${text}</div><div>${buttons}</div></div>`;
    document.body.appendChild(overlay);
    document.body.classList.add("modalOpen");
    document.body.style.animation = "shake .2s";
    setTimeout(() => {
      document.body.style.animation = "";
      overlay.querySelector("button, [tabindex='0']")?.focus();
    }, 220);
  };

  function addGameBar() {
    const gameElement = document.getElementById("game");
    const hudElement = document.getElementById("hud");
    if (!gameElement || !hudElement || document.querySelector(".gameBar")) return;
    const bar = document.createElement("div");
    bar.className = "gameBar";
    bar.innerHTML = `<div class="gameBarBrand"><span class="gameBarTitle">THE PU$HER</span><span class="gameBarSub">Market Run · Rebuilt</span></div><button onclick="showPriceHub()">Compare Cities</button>`;
    gameElement.insertBefore(bar, hudElement);
  }

  function updateActionDeck() {
    const deck = document.querySelector(".bottom");
    if (!deck) return;
    const actions = Array.from(deck.querySelectorAll(".action"));
    actions.forEach((action) => {
      const handler = action.getAttribute("onclick") || "";
      if (handler.includes("hospital")) action.textContent = "RECOVER";
      if (handler.includes("stay") || handler.includes("travel")) action.classList.add("primaryAction");
      action.setAttribute("role", "button");
      action.setAttribute("tabindex", "0");
    });

    if (!deck.querySelector("[data-price-hub]")) {
      const hub = document.createElement("div");
      hub.className = "action primaryAction";
      hub.dataset.priceHub = "true";
      hub.setAttribute("role", "button");
      hub.setAttribute("tabindex", "0");
      hub.setAttribute("onclick", "showPriceHub()");
      hub.textContent = "PRICE HUB";
      const saveAction = actions.find((action) => (action.getAttribute("onclick") || "").includes("manualSave"));
      deck.insertBefore(hub, saveAction || null);
    }
  }

  function updateHandbook() {
    const version = document.getElementById("ver");
    const cloud = document.getElementById("cloud");
    if (version) version.textContent = "v2.0 MARKET REBUILD";
    if (cloud) cloud.textContent = "● DEVICE SAVE READY";

    document.querySelectorAll(".graffitiRule").forEach((rule) => {
      const text = rule.textContent || "";
      if (text.includes("THE MARKET")) {
        rule.innerHTML = `<b>THE MARKET</b><br>Every graph, trend label, price change, and Risk 1–5 score comes from the same live price history. Rising means the recent line is consistently climbing. Mixed swings show Choppy or Volatile instead of pretending to be Stable.`;
      } else if (text.includes("STAY / TRAVEL")) {
        rule.innerHTML = `<b>STAY / TRAVEL</b><br>STAY and TRAVEL each move every city market forward one day. Open PRICE HUB to compare all cities before you move. The board is view-only; trades happen where you are.`;
      } else if (text.includes("HEALTH / HOSPITAL")) {
        rule.innerHTML = `<b>CONDITION / RECOVERY</b><br>Condition drops only when something actually hurts you—fights, robberies, chases, and bad encounters. Low condition reduces carrying capacity. Lay low for free, use a clinic, or pay for a full hospital recovery.`;
      } else if (text.includes("THE STREETS")) {
        rule.innerHTML = `<b>THE STREETS</b><br>Street events now roll only when a day passes, never on every buy or sell. Events have at least a three-day gap, so the market stays in control of the game. High heat still raises danger.`;
      }
    });
  }

  function installKeyboardSupport() {
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target.closest(".action, .startBtn, .pickCard");
      if (!target) return;
      event.preventDefault();
      target.click();
    });
  }

  window.showPriceHub = showPriceHub;
  window.finishTravelArrival = finishTravelArrival;
  window.recoverLayLow = recoverLayLow;
  window.recoverClinic = recoverClinic;
  window.recoverHospital = recoverHospital;

  syncCurrentMarket();
  addGameBar();
  updateActionDeck();
  updateHandbook();
  installKeyboardSupport();
})();
