const { initializeApp } = require("firebase/app");
const fs = require("fs");
const configStr = fs.readFileSync("firebase-applet-config.json", "utf8");
const app = initializeApp(JSON.parse(configStr));
console.log(app ? "App is ok" : "App is null", Object.keys(app || {}));
