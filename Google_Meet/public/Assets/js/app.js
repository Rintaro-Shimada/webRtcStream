const myApp = function () {
  let socket = null;
  let userId = "";
  let meetingId = "";

  function init(uid, mid) {
    userId = uid
    meetingId = mid
    eventProcessForSignalingServer();
  }

  function eventProcessForSignalingServer() {
    socket = io.connect();
    socket.on("connect", () => {
      if (socket.connected) {
        if (userId !== "" && meetingId !== "") {
          socket.emit("userConnect", {
            displayName: userId,
            meetingId: meetingId,
          });
        }
      }
    });

    socket.on("informOthersAboutMe", function (data){
      addUser(data.otherUserId, data.connectionId)
    })
  }
  function addUser(otherUserId, connectionId){
    let newDivId = $("#otherTemplate").clone();
    newDivId = newDivId.attr("id", connectionId).addClass("other");
    newDivId.find("h2").text(otherUserId);
    newDivId.find("video").attr("id", "v_" + connectionId);
    newDivId.find("audio").attr("id", "a_" + connectionId);

  }

  return {
    _init: function (uid, mid) {
      init(uid, mid);
    }
  }
}