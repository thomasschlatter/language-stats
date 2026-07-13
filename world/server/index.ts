import dotenv from "dotenv";

import https from "https";
import http from "http";
import fs from "fs";
import express from "express";
import cors from "cors";
import { Server, LobbyRoom } from "colyseus";
import { monitor } from "@colyseus/monitor";
import { RoomType } from "../types/Rooms";
import { SkyOffice } from "./rooms/SkyOffice";

const port = Number(process.env.PORT || 2567);
const app = express();

app.use(cors());
app.use(express.json());

var options = {};

if (process.env.NODE_ENV === "production") {
  options = {
    key: fs.readFileSync(process.env.TLS_KEY_PATH || "/app/certbot/config/privkey3.pem"),
    cert: fs.readFileSync(process.env.TLS_CERT_PATH || "/app/certbot/config/fullchain3.pem"),
  };
}

var server: any;
var protocol: string;

// normal
if (process.env.NODE_ENV === "production") {
  server = https.createServer(options, app);
  protocol = "https";
} else {
  server = http.createServer(app);
  protocol = "http";
}

const gameServer = new Server({
  server,
});

gameServer.define(RoomType.LOBBY, LobbyRoom);
gameServer.define(RoomType.PUBLIC, SkyOffice, {
  name: "Public Lobby",
  description:
    "For making friends and familiarizing yourself with the controls",
  password: null,
  autoDispose: false,
});
gameServer.define(RoomType.CUSTOM, SkyOffice).enableRealtimeListing();

app.use("/colyseus", monitor());

gameServer.listen(port);

console.log(`Listening on ${protocol}://localhost:${port}`);
