import express from "express";
// import WebSocket from "ws";
import SocketIO from "socket.io";
import http from "http";


const PORT = process.env.PORT || 4000;


const app = express();
const fs = require("fs");
let roomName = "";
let nickname = "";

app.set("view engine", "pug");
app.set("views", process.cwd() + "/src/views");
app.use(express.json());
app.use(express.urlencoded({extended: false}));

app.use("/public", express.static(process.cwd() + "/src/public"));

app.get("/favicon.ico", (req, res) => res.status(204).end());

app.get("/:id", (req, res) => {
  if(req.params){
    roomName = req.params.id;
    res.sendFile(__dirname + "/views/popup.html");
  }
  else 
    res.redirect("/");
});
app.post("/nickpost",(req,res)=>{
  console.log(req.body.Nick);
  nickname = req.body.Nick;
  res.redirect("/");
})

app.get("/", (req, res) => {
  res.render("home");
});

const httpServer = http.createServer(app);
const wsServer = SocketIO(httpServer);


let roomObjArr = [
  // {
  //   roomName,
  //   currentNum,
  //   users: [
  //     {
  //       socketId,
  //       nickname,
  //     },
  //   ],
  // },
];
const MAXIMUM = 5;

wsServer.on("connection", (socket) => {
  let myRoomName = null;
  let myNickname = null;
  if(roomName!=null){
    console.log(roomName);
    console.log(nickname);
    socket.emit("test", roomName, nickname);
    roomName = null;
}
  socket.on("join_room", (roomName, nickname) => {
    myRoomName = roomName;
    myNickname = nickname;
    console.log("joined");
    let isRoomExist = false;
    let targetRoomObj = null;
    // forEach를 사용하지 않는 이유: callback함수를 사용하기 때문에 return이 효용없음.
    for (let i = 0; i < roomObjArr.length; ++i) {
      if (roomObjArr[i].roomName === roomName) {
        // Reject join the room
        if (roomObjArr[i].currentNum >= MAXIMUM) {
          socket.emit("reject_join");
          return;
        }

        isRoomExist = true;
        targetRoomObj = roomObjArr[i];
        break;
      }
    }

    // Create room
    if (!isRoomExist) {
      targetRoomObj = {
        roomName,
        currentNum: 0,
        users: [],
      };
      roomObjArr.push(targetRoomObj);
    }

    //Join the room
    targetRoomObj.users.push({
      socketId: socket.id,
      nickname,
    });
    ++targetRoomObj.currentNum;

    socket.join(roomName);
    console.log(wsServer.sockets.adapter.rooms.get(roomName));
    socket.emit("accept_join", targetRoomObj.users);
  });

  socket.on("offer", (offer, remoteSocketId, localNickname) => {
    socket.to(remoteSocketId).emit("offer", offer, socket.id, localNickname);
  });

  socket.on("answer", (answer, remoteSocketId) => {
    socket.to(remoteSocketId).emit("answer", answer, socket.id);
  });

  socket.on("ice", (ice, remoteSocketId) => {
    socket.to(remoteSocketId).emit("ice", ice, socket.id);
  });

  socket.on("chat", (message, roomName) => {
    console.log(message)
    console.log(roomName);
    socket.to(roomName).emit("chat", message);
  });

  socket.on("disconnecting", () => {
    socket.to(myRoomName).emit("leave_room", socket.id, myNickname);

    let isRoomEmpty = false;
    for (let i = 0; i < roomObjArr.length; ++i) {
      if (roomObjArr[i].roomName === myRoomName) {
        const newUsers = roomObjArr[i].users.filter(
          (user) => user.socketId != socket.id
        );
        roomObjArr[i].users = newUsers;
        --roomObjArr[i].currentNum;

        if (roomObjArr[i].currentNum == 0) {
          isRoomEmpty = true;
        }
      }
    }

    // Delete room
    if (isRoomEmpty) {
      const newRoomObjArr = roomObjArr.filter(
        (roomObj) => roomObj.currentNum != 0
      );
      roomObjArr = newRoomObjArr;
    }
  });
});

const handleListen = () =>
  console.log(`✅ Listening on http://localhost:${PORT}`);
httpServer.listen(PORT, handleListen);
