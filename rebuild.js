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

  refreshPrices = function rebuiltRefreshPrices() {
    advanceAllMarkets();
  };

  syncCurrentMarket();
})();