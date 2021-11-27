const express = require("express");
const path = require("path");

const app = express();
const port = 3000;
const server = app.listen(port, function () {
  console.log("listening on Port", port);
})

const io = require("socket.io")(server, {
  allowEIO3: true,
});

app.use(express.static(path.join(__dirname, "")));
let userConnections = [];
io.on("connection", (socket) => {
  console.log("socket id is ", socket.id);
  socket.on("userConnect", (data)=>{
    console.log("userConnect", data.displayName, data.meetingId);
    var otherUsers = userConnections.filter((p) => p.meetingId === data.meetingId);
    userConnections.push({
      connectionId: socket.id,
      userId: data.userId,
      meetingId: data.meetingId,
    });

    otherUsers.forEach((v) => {
      socket.to(v.connectionId).emit("informOthersAboutMe", {
        otherUserId: data.displayName,
        connectionId: socket.id,
      });
    });

    socket.emit("informMeAboutOtherUser", otherUsers);
  })
  socket.on("SDPProcess", (data)=> {
    socket.to(data.toConnectionId).emit("SDPProcess", {
      message: data.message,
      fromConnectionId: socket.id,
    })
  })
})