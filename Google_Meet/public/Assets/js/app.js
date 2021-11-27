const AppProcess = function (){
  let serverProcess;
  let peersConnectionIds = [];
  let peersConnection = [];
  let remoteVideoStream = [];
  let remoteAudioStream = [];
  let localDiv;
  let audio;
  let isAudioMute = true;
  let rtpAudioSenders = [];
  const videoStates = {
    none:0,
    camera: 1,
    screenShere:2
  };
  let videoSt = videoStates.none;
  let videoTracks;

  async function _init(SDP_function, myConnectionId){
    serverProcess = SDP_function;
    myConnectionId = myConnectionId;
    eventProcess();
    localDiv = document.getElementById("localVideoPlayer");
  }

  function eventProcess(){
    $("#miceMuteUnmute").on("click", async function (){
      if(!audio){
        await loadAudio();
      }
      if(!audio){
        alert("Audio Permission has not grated");
        return;
      }
      if(isAudioMute){
        audio.enabled = true;
        $(this).html("<span class='material-icons'>mic</span>");
        updateMediaSenders(audio, rtpAudioSenders);
      } else {
        audio.enabled = false;
        $(this).html("<span class='material-icons'>mic-off</span>");
        removeMediaSenders(rtpAudioSenders);
      }
      isAudioMute = !isAudioMute;
    })

    $("videoCamOnOff").on("click", async function (){
      if(videoSt === videoStates.camera){
        await videoProcess(videoStates.none)
      } else {
        await videoProcess(videoStates.camera)
      }
    })
    $("btnScreenShareOnOff").on("click", async function (){
      if(videoSt === videoStates.camera){
        await videoProcess(videoStates.none)
      } else {
        await videoProcess(videoStates.screenShere)
      }
    })
  }

  async function videoProcess(newVideoState) {
    try {
      let vStream = null;
      if (newVideoState === videoStates.camera){
        vStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 1920,
            height: 1080
          },
          audio:false
        })
      } else if(newVideoState === videoStates.screenShere){
        vStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: 1920,
            height: 1080
          },
          audio:false
        })
      }
      if(vStream && vStream.getVideoTracks().length > 0){
        videoTracks = vStream.getVideoTracks()[0];
        if(videoTracks){
          localDiv.srcObject = new MediaStream([videoTracks]);
          alert("video can found");
        }
      }
    } catch (e) {
      console.log(e)
      return;
    }
    videoSt = newVideoState;
  }

  const iceConfiguration = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19382",
      },
      {
        urls: "stun:stun1.l.google.com:19382",
      },
    ]
  }

  async function setConnection(connectionId){
    const connection = new RTCPeerConnection(iceConfiguration);
    connection.onnegotiationneeded = async function(event) {
      await setOffer(connectionId);
    }
    connection.onicecandidate = function (event){
      if(event.candidate){
        serverProcess(JSON.stringify({icecandidate: event.candidate}), connectionId)
      }
    }
    connection.ontrack = function (event){
      if(!remoteVideoStream[connectionId]){
        remoteVideoStream[connectionId] = new MediaStream();
      }
      if(!remoteAudioStream[connectionId]){
        remoteAudioStream[connectionId] = new MediaStream();
      }

      if(event.track.kind === "video"){
        remoteVideoStream[connectionId].getVideoTracks().forEach((t) => remoteVideoStream[connectionId].removetrack(t));
        remoteVideoStream[connectionId].addTrack(event.track);

        let remoteVideoPlayer = document.getElementById("v_" + connectionId);
        remoteVideoPlayer.srcObject = null;
        remoteVideoPlayer.srcObject = remoteVideoStream[connectionId];
        remoteVideoPlayer.load();
      }else if (event.track.kind === "audio"){
        remoteAudioStream[connectionId].getAudioTracks().forEach((t) => remoteAudioStream[connectionId].removetrack(t));
        remoteAudioStream[connectionId].addTrack(event.track);

        let remoteAudioPlayer = document.getElementById("a_" + connectionId);
        remoteAudioPlayer.srcObject = null;
        remoteAudioPlayer.srcObject = remoteAudioStream[connectionId];
        remoteAudioPlayer.load();
      }
    }
    peersConnectionIds[connectionId] = connectionId;
    peersConnection[connectionId] = connection;

    return connection;
  }

  async function setOffer(connectionId){
    const connection = peersConnection[connectionId];
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    serverProcess(JSON.stringify({
      offer: connection.localDescription(),
    }), connectionId)
  }

  async function SDPProcess(message, fromConnectionId) {
    message = JSON.parse(message);
    if(message.answer){
      await peersConnection[fromConnectionId].setRemoteDescription(new RTCSessionDescription(message.answer))
    } else if(message.offer){
      if(!peersConnection[fromConnectionId]){
        await setConnection(fromConnectionId)
      }
      await peersConnection[fromConnectionId].setRemoteDescription(new RTCSessionDescription(message.offer))
      const answer = await peersConnection[fromConnectionId].createAnswer();
      await peersConnection[fromConnectionId].setLocalDescription(answer);
      serverProcess(
        JSON.stringify({
          answer: answer,
        }),
        connectionId
      )
    } else if(message.icecandidate) {
      if(!peersConnection[fromConnectionId]){
        await setConnection(fromConnectionId);
      }
      try {
        await peersConnection[fromConnectionId].addIceCandidate(message.icecandidate);
      } catch (e){
        console.log(e);
      }
    }
  }

  return {
    setNewConnection: async function(connectionId){
      await setConnection(connectionId);
    },
    init: async function(SDP_function, myConnectionId){
      await _init(SDP_function, myConnectionId)
    },
    processClientFunc: async function(data, fromConnectionId){
      await SDPProcess(data, fromConnectionId)
    }
  };
};

const MyApp = function () {
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

    let SDP_function = function (data, toConnectionId){
      socket.emit("SDPProcess", {
        message: data,
        toConnectionId: toConnectionId,
      });
    }
    socket.on("connect", () => {
      if (socket.connected) {
        AppProcess.init(SDP_function, socket.id);
        if (userId !== "" && meetingId !== "") {
          socket.emit("userConnect", {
            displayName: userId,
            meetingId: meetingId,
          });
        }
      }
    });

    socket.on("informOthersAboutMe", function (data){
      addUser(data.otherUserId, data.connectionId);
      AppProcess.setNewConnection(data.connectionId);
    });
    socket.on("informMeAboutOtherUser", function (otherUsers){
      if(otherUsers){
        for (let i = 0; i < otherUsers.length; i++) {
          addUser(otherUsers[i].userId,otherUsers[i].connectionId)
          AppProcess.setNewConnection(otherUsers[i].connectionId);
        }
      }
    });

    socket.on("SDPProcess", async function (data){
      await AppProcess.processClientFunc(data.message, data.fromConnectionId);
    })
  }
  function addUser(otherUserId, connectionId){
    let newDivId = $("#otherTemplate").clone();
    newDivId = newDivId.attr("id", connectionId).addClass("other");
    newDivId.find("h2").text(otherUserId);
    newDivId.find("video").attr("id", "v_" + connectionId);
    newDivId.find("audio").attr("id", "a_" + connectionId);
    newDivId.show();
    $("#divUsers").append(newDivId);
  }

  return {
    _init: function (uid, mid) {
      init(uid, mid);
    }
  }
}