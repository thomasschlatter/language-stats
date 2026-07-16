import React, { useState } from "react";
import styled from "styled-components";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Avatar from "@mui/material/Avatar";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";
import ArrowLeftIcon from "@mui/icons-material/ArrowLeft";

import { useAppSelector, useAppDispatch } from "../hooks";
//import { setLoggedIn, setAvatarId } from '../stores/UserStore'
import { setLoggedIn } from "../stores/UserStore";
import { getAvatarString, getColorByString } from "../util";

import phaserGame from "../PhaserGame";
import Game from "../scenes/Game";
import { AVATAR_STYLES } from "./characterstyles";
import {
  Backdrop,
  Box,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";

import { v4 as uuidv4 } from "uuid";
import { validate as isValidUUID } from "uuid";
import { FRAMES } from "../anims/frames";

const baseURL = import.meta.env.VITE_API_URL_PROD;

const Wrapper = styled.form`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #222639;
  border-radius: 16px;
  padding: 36px 60px;
  box-shadow: 0px 0px 5px #0000006f;
`;

const Title = styled.p`
  margin: 5px;
  font-size: 20px;
  color: #c2c2c2;
  text-align: center;
`;

const SubTitle = styled.h3`
  width: 160px;
  font-size: 16px;
  color: #eee;
  text-align: center;
`;

const Content = styled.div`
  display: flex;
  margin: 36px 0;
`;

const Left = styled.div`
  margin-right: 0px;
  width: 300px;
  --swiper-navigation-size: 24px;
`;

const Right = styled.div`
  margin-left: 48px;
  width: 200px;
`;

const Bottom = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Warning = styled.div`
  margin-top: 30px;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const CANVAS_HIDDEN = {
  width: 1854,
  height: 1312,
};

const CANVAS_COMPLETE_HIDDEN = {
  width: 1664,
  height: 48,
};

const CANVAS = {
  width: 300,
  height: 150,
};

const POSITIONS = {
  IDLE_RIGHT: {
    sx: 0,
    sy: 74,
    sWidth: 192,
    sHeight: 54,
    dx: 0,
    dy: 0,
    dWidth: 192,
    dHeight: 48,
  },
  IDLE_UP: {
    sx: 192,
    sy: 74,
    sWidth: 192,
    sHeight: 54,
    dx: 192,
    dy: 0,
    dWidth: 192,
    dHeight: 48,
  },
  IDLE_LEFT: {
    sx: 384,
    sy: 74,
    sWidth: 192,
    sHeight: 54,
    dx: 384,
    dy: 0,
    dWidth: 192,
    dHeight: 48,
  },
  IDLE_DOWN: {
    sx: 576,
    sy: 74,
    sWidth: 192,
    sHeight: 54,
    dx: 576,
    dy: 0,
    dWidth: 192,
    dHeight: 48,
  },
  RUN_RIGHT: {
    sx: 0,
    sy: 138,
    sWidth: 192,
    sHeight: 54,
    dx: 768,
    dy: 0,
    dWidth: 192,
    dHeight: 48,
  },
  RUN_UP: {
    sx: 192,
    sy: 138,
    sWidth: 192,
    sHeight: 54,
    dx: 960,
    dy: 0,
    dWidth: 192,
    dHeight: 48,
  },
  RUN_LEFT: {
    sx: 384,
    sy: 138,
    sWidth: 192,
    sHeight: 54,
    dx: 1152,
    dy: 0,
    dWidth: 192,
    dHeight: 48,
  },
  RUN_DOWN: {
    sx: 576,
    sy: 138,
    sWidth: 192,
    sHeight: 54,
    dx: 1344,
    dy: 0,
    dWidth: 192,
    dHeight: 48,
  },
  SIT_RIGHT: {
    sx: 0,
    sy: 268,
    sWidth: 32,
    sHeight: 54,
    dx: 1600,
    dy: 0,
    dWidth: 32,
    dHeight: 48,
  },
  SIT_LEFT: {
    sx: 192,
    sy: 268,
    sWidth: 32,
    sHeight: 54,
    dx: 1568,
    dy: 0,
    dWidth: 32,
    dHeight: 48,
  },
  SIT_UP: {
    sx: 192,
    sy: 524,
    sWidth: 32,
    sHeight: 54,
    dx: 1632,
    dy: 0,
    dWidth: 32,
    dHeight: 48,
  },
  SIT_DOWN: {
    sx: 576,
    sy: 524,
    sWidth: 32,
    sHeight: 54,
    dx: 1536,
    dy: 0,
    dWidth: 32,
    dHeight: 48,
  },
};

const avatars = [
  { name: "adam", img: "Adam" },
  // { name: 'ash', img: 'Ash' },
  // { name: 'lucy', img: "Lucy" },
  // { name: 'nancy', img: "Nancy" },
];

// shuffle the avatars array
for (let i = avatars.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [avatars[i], avatars[j]] = [avatars[j], avatars[i]];
}

interface IAvatar {
  Bodies: string;
  Accessories: string;
  Bodies_kids: string;
  Outfits_kids: string;
  Books: string;
  Outfits: string;
  Hairstyles: string;
  Smartphones: string;
  Eyes: string;
  Hairstyles_kids: string;
  Eyes_kids: string;
}
interface IAvatarIndex {
  Bodies: number;
  Accessories: number;
  Bodies_kids: number;
  Outfits_kids: number;
  Books: number;
  Outfits: number;
  Hairstyles: number;
  Smartphones: number;
  Eyes: number;
  Hairstyles_kids: number;
  Eyes_kids: number;
}

// shuffle the avatars array
for (let i = avatars.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [avatars[i], avatars[j]] = [avatars[j], avatars[i]];
}

export default function CharacterCreation() {
  function createLocalStorageIndex() {
    localStorage.setItem(
      "strndd-avatar_index",
      JSON.stringify({
        Bodies: 0,
        Accessories: 0,
        Bodies_kids: 0,
        Outfits_kids: 0,
        Books: 0,
        Outfits: 0,
        Hairstyles: 0,
        Smartphones: 0,
        Eyes: 0,
        Hairstyles_kids: 0,
        Eyes_kids: 0,
      })
    );
    return {
      Bodies: 0,
      Accessories: 0,
      Bodies_kids: 0,
      Outfits_kids: 0,
      Books: 0,
      Outfits: 0,
      Hairstyles: 0,
      Smartphones: 0,
      Eyes: 0,
      Hairstyles_kids: 0,
      Eyes_kids: 0,
    };
  }

  function createLocalStorageName() {
    localStorage.setItem("strndd-avatar_name", "");
    return "";
  }
  function createLocalStorageUrl() {
    localStorage.setItem("strndd-avatar_url", "");
    return "";
  }
  function createLocalStorageUuid() {
    localStorage.setItem("strndd-avatar_uuid", "");
    return "";
  }

  function createLocalStorage() {
    localStorage.setItem(
      "strndd-avatar_index",
      JSON.stringify({
        Bodies: 0,
        Accessories: 0,
        Bodies_kids: 0,
        Outfits_kids: 0,
        Books: 0,
        Outfits: 0,
        Hairstyles: 0,
        Smartphones: 0,
        Eyes: 0,
        Hairstyles_kids: 0,
        Eyes_kids: 0,
      })
    );
    localStorage.setItem("strndd-avatar_name", "");
    localStorage.setItem("strndd-avatar_url", "");
    localStorage.setItem("strndd-avatar_uuid", "");
  }
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  // all
  const canvasHiddenRef = React.useRef<HTMLCanvasElement>(null);
  // complete
  const canvasCompleteHiddenRef = React.useRef<HTMLCanvasElement>(null);
  // rest
  const [name, setName] = useState<string>(
    // Name comes from the account (?name=<username>); the name field was removed.
    // Fall back through localStorage to a generated name so it's never empty.
    new URLSearchParams(window.location.search).get("name") ||
      localStorage.getItem("strndd-avatar_name") ||
      createLocalStorageName() ||
      "Guest"
  );
  const formRef = React.useRef<HTMLFormElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>(
    localStorage.getItem("strndd-avatar_url") || createLocalStorageUrl()
  );
  const [uuid, setUuid] = useState<string>(
    localStorage.getItem("strndd-avatar_uuid") || createLocalStorageUuid()
  );
  const [avatarStyleIndex, setAvatarStyleIndex] = useState<IAvatarIndex>(
    // When opened from language-stats, ?avatar=<json> hands off the character
    // (its layer indices map 1:1 onto STRANDED's, since ours is a slice of it).
    {
      ...JSON.parse(
        localStorage.getItem("strndd-avatar_index") ||
          JSON.stringify(createLocalStorageIndex())
      ),
      ...(() => {
        try {
          const a = new URLSearchParams(window.location.search).get("avatar");
          return a ? JSON.parse(a) : {};
        } catch {
          return {};
        }
      })(),
    }
  );

  const [avatarStyle, setAvatarStyle] = useState<IAvatar>({
    Bodies: AVATAR_STYLES["Bodies"][avatarStyleIndex.Bodies],
    Accessories: AVATAR_STYLES["Accessories"][avatarStyleIndex.Accessories],
    Bodies_kids: AVATAR_STYLES["Bodies_kids"][avatarStyleIndex.Bodies_kids],
    Outfits_kids: AVATAR_STYLES["Outfits_kids"][avatarStyleIndex.Outfits_kids],
    Books: AVATAR_STYLES["Books"][avatarStyleIndex.Books],
    Outfits: AVATAR_STYLES["Outfits"][avatarStyleIndex.Outfits],
    Hairstyles: AVATAR_STYLES["Hairstyles"][avatarStyleIndex.Hairstyles],
    Smartphones: AVATAR_STYLES["Smartphones"][avatarStyleIndex.Smartphones],
    Eyes: AVATAR_STYLES["Eyes"][avatarStyleIndex.Eyes],
    Hairstyles_kids:
      AVATAR_STYLES["Hairstyles_kids"][avatarStyleIndex.Hairstyles_kids],
    Eyes_kids: AVATAR_STYLES["Eyes_kids"][avatarStyleIndex.Eyes_kids],
  });

  const [avatarIndex, setAvatarIndex] = useState<number>(0);
  const [nameFieldEmpty, setNameFieldEmpty] = useState<boolean>(false);
  const dispatch = useAppDispatch();
  const videoConnected = useAppSelector((state) => state.user.videoConnected);
  const roomJoined = useAppSelector((state) => state.room.roomJoined);
  const roomName = useAppSelector((state) => state.room.roomName);
  const roomDescription = useAppSelector((state) => state.room.roomDescription);

  // draw avatar
  function drawAvatar() {
    if (canvasRef.current) {
      // draw visible canvas
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      // clear whats on the canvas
      context?.clearRect(0, 0, canvas.width, canvas.height);
      if (context) {
        const bodyImg = new Image();
        bodyImg.src = AVATAR_STYLES["Bodies"][avatarStyleIndex.Bodies];
        bodyImg.onload = function () {
          context.drawImage(
            bodyImg,
            0,
            0,
            bodyImg.width * 2.25,
            bodyImg.height * 2.25
          );
          // draw the head on top of the body
          const hairImg = new Image();
          hairImg.src =
            AVATAR_STYLES["Hairstyles"][avatarStyleIndex.Hairstyles];
          hairImg.onload = function () {
            context.drawImage(
              hairImg,
              0,
              0,
              hairImg.width * 2.25,
              hairImg.height * 2.25
            );
            // draw the eyes on top of the head
            const eyesImg = new Image();
            eyesImg.src = AVATAR_STYLES["Eyes"][avatarStyleIndex.Eyes];
            eyesImg.onload = function () {
              context.drawImage(
                eyesImg,
                0,
                0,
                eyesImg.width * 2.25,
                eyesImg.height * 2.25
              );
              // draw the accessories on top of the eyes
              const accessoriesImg = new Image();
              accessoriesImg.src =
                AVATAR_STYLES["Accessories"][avatarStyleIndex.Accessories];
              accessoriesImg.onload = function () {
                context.drawImage(
                  accessoriesImg,
                  0,
                  0,
                  accessoriesImg.width * 2.25,
                  accessoriesImg.height * 2.25
                );
                // draw the outfits on top of the accessories
                const outfitsImg = new Image();
                outfitsImg.src =
                  AVATAR_STYLES["Outfits"][avatarStyleIndex.Outfits];
                outfitsImg.onload = function () {
                  context.drawImage(
                    outfitsImg,
                    0,
                    0,
                    outfitsImg.width * 2.25,
                    outfitsImg.height * 2.25
                  );
                };
              };
            };
          };
        };
      }
    }
    if (canvasCompleteHiddenRef.current) {
      const canvas = canvasCompleteHiddenRef.current;
      const context = canvas.getContext("2d");
      // clear whats on the canvas
      context?.clearRect(0, 0, canvas.width, canvas.height);
      if (context) {
        [
          "IDLE_DOWN",
          "IDLE_UP",
          "IDLE_LEFT",
          "IDLE_RIGHT",
          "RUN_DOWN",
          "RUN_UP",
          "RUN_LEFT",
          "RUN_RIGHT",
          "SIT_RIGHT",
          "SIT_LEFT",
          "SIT_DOWN",
          "SIT_UP",
        ].forEach((position) => {
          const bodyImg = new Image();
          bodyImg.src = AVATAR_STYLES["Bodies"][avatarStyleIndex.Bodies];
          bodyImg.onload = function () {
            context.drawImage(
              bodyImg,
              POSITIONS[position].sx,
              POSITIONS[position].sy,
              POSITIONS[position].sWidth,
              POSITIONS[position].sHeight,
              POSITIONS[position].dx,
              POSITIONS[position].dy,
              POSITIONS[position].dWidth,
              POSITIONS[position].dHeight
            );
            // draw the head on top of the body
            const headImg = new Image();
            headImg.src =
              AVATAR_STYLES["Hairstyles"][avatarStyleIndex.Hairstyles];
            headImg.onload = function () {
              context.drawImage(
                headImg,
                POSITIONS[position].sx,
                POSITIONS[position].sy,
                POSITIONS[position].sWidth,
                POSITIONS[position].sHeight,
                POSITIONS[position].dx,
                POSITIONS[position].dy,
                POSITIONS[position].dWidth,
                POSITIONS[position].dHeight
              );
              // draw the eyes on top of the head
              const eyesImg = new Image();
              eyesImg.src = AVATAR_STYLES["Eyes"][avatarStyleIndex.Eyes];
              eyesImg.onload = function () {
                context.drawImage(
                  eyesImg,
                  POSITIONS[position].sx,
                  POSITIONS[position].sy,
                  POSITIONS[position].sWidth,
                  POSITIONS[position].sHeight,
                  POSITIONS[position].dx,
                  POSITIONS[position].dy,
                  POSITIONS[position].dWidth,
                  POSITIONS[position].dHeight
                );
                // draw the accessories on top of the eyes
                const accessoriesImg = new Image();
                accessoriesImg.src =
                  AVATAR_STYLES["Accessories"][avatarStyleIndex.Accessories];
                accessoriesImg.onload = function () {
                  context.drawImage(
                    accessoriesImg,
                    POSITIONS[position].sx,
                    POSITIONS[position].sy,
                    POSITIONS[position].sWidth,
                    POSITIONS[position].sHeight,
                    POSITIONS[position].dx,
                    POSITIONS[position].dy,
                    POSITIONS[position].dWidth,
                    POSITIONS[position].dHeight
                  );
                  // draw the outfits on top of the accessories
                  const outfitsImg = new Image();
                  outfitsImg.src =
                    AVATAR_STYLES["Outfits"][avatarStyleIndex.Outfits];
                  outfitsImg.onload = function () {
                    context.drawImage(
                      outfitsImg,
                      POSITIONS[position].sx,
                      POSITIONS[position].sy,
                      POSITIONS[position].sWidth,
                      POSITIONS[position].sHeight,
                      POSITIONS[position].dx,
                      POSITIONS[position].dy,
                      POSITIONS[position].dWidth,
                      POSITIONS[position].dHeight
                    );
                  };
                };
              };
            };
          };
        });
      }
    }
  }

  // backdrop
  const handleClose = () => {
    setIsLoading(false);
  };

  // game
  const game = phaserGame.scene.keys.game as Game;
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [userAlreadyExists, setUserAlreadyExists] = useState<boolean>(false);

  // State to track screen size
  const [isMobile, setIsMobile] = useState(false);

  // Function to check screen size and update state
  const checkScreenSize = () => {
    setIsMobile(window.innerWidth <= 768); // You can adjust the breakpoint as needed
  };

  React.useEffect(() => {
    if (
      localStorage.getItem("strndd-avatar_index") === null ||
      localStorage.getItem("strndd-avatar_index") === undefined ||
      localStorage.getItem("strndd-avatar_uuid") === null ||
      localStorage.getItem("strndd-avatar_uuid") === undefined
    ) {
      setUserAlreadyExists(false);
      return () => {};
    }
    // if cookie uuid is not a uuid
    if (
      localStorage.getItem("strndd-avatar_uuid") === null &&
      !isValidUUID(localStorage.getItem("strndd-avatar_uuid"))
    ) {
      setUserAlreadyExists(false);
      return () => {};
    }
    if (
      localStorage.getItem("strndd-avatar_uuid") &&
      isValidUUID(localStorage.getItem("strndd-avatar_uuid"))
    ) {
      try {
        setUserAlreadyExists(true);
        setNameFieldEmpty(false);
      } catch (error) {
        console.log(error);
      }
    }

    checkScreenSize(); // Initial check
    window.addEventListener("resize", checkScreenSize);

    // Clean up the event listener when the component unmounts
    return () => {
      window.removeEventListener("resize", checkScreenSize);
    };
  }, []);

  React.useEffect(() => {
    // set user exists to false if avatar style index changes
    let savedAvatarStyleIndex = localStorage.getItem("strndd-avatar_index");
    if (savedAvatarStyleIndex === null) {
      createLocalStorage();
      return;
    }
    const initialValue = JSON.parse(savedAvatarStyleIndex);
    if (
      initialValue["Bodies"] == avatarStyleIndex["Bodies"] &&
      initialValue["Accessories"] == avatarStyleIndex["Accessories"] &&
      initialValue["Bodies_kids"] == avatarStyleIndex["Bodies_kids"] &&
      initialValue["Outfits_kids"] == avatarStyleIndex["Outfits_kids"] &&
      initialValue["Books"] == avatarStyleIndex["Books"] &&
      initialValue["Outfits"] == avatarStyleIndex["Outfits"] &&
      initialValue["Hairstyles"] == avatarStyleIndex["Hairstyles"] &&
      initialValue["Smartphones"] == avatarStyleIndex["Smartphones"] &&
      initialValue["Eyes"] == avatarStyleIndex["Eyes"] &&
      initialValue["Hairstyles_kids"] == avatarStyleIndex["Hairstyles_kids"] &&
      initialValue["Eyes_kids"] == avatarStyleIndex["Eyes_kids"]
    ) {
      console.log("avatarStyleIndex has not changed");
    } else {
      console.log("avatarStyleIndex has changed");
      setUserAlreadyExists(false);
    }
  }, [avatarStyleIndex]);

  React.useEffect(() => {
    setAvatarStyle({
      Bodies: AVATAR_STYLES["Bodies"][avatarStyleIndex.Bodies],
      Accessories: AVATAR_STYLES["Accessories"][avatarStyleIndex.Accessories],
      Bodies_kids: AVATAR_STYLES["Bodies_kids"][avatarStyleIndex.Bodies_kids],
      Outfits_kids:
        AVATAR_STYLES["Outfits_kids"][avatarStyleIndex.Outfits_kids],
      Books: AVATAR_STYLES["Books"][avatarStyleIndex.Books],
      Outfits: AVATAR_STYLES["Outfits"][avatarStyleIndex.Outfits],
      Hairstyles: AVATAR_STYLES["Hairstyles"][avatarStyleIndex.Hairstyles],
      Smartphones: AVATAR_STYLES["Smartphones"][avatarStyleIndex.Smartphones],
      Eyes: AVATAR_STYLES["Eyes"][avatarStyleIndex.Eyes],
      Hairstyles_kids:
        AVATAR_STYLES["Hairstyles_kids"][avatarStyleIndex.Hairstyles_kids],
      Eyes_kids: AVATAR_STYLES["Eyes_kids"][avatarStyleIndex.Eyes_kids],
    });
    drawAvatar();
  }, [avatarStyleIndex]);

  // Skip the editor for users who already have a character: either handed off from
  // language-stats (?avatar=<json>) or saved locally from a previous visit. Such users
  // are dropped straight into the world — the editor only shows for genuinely new users.
  // New users still get the full editor (minus the name field). We poll for the composite
  // canvas to be drawn before auto-submitting, so the avatar isn't blank.
  const autoEnteredRef = React.useRef(false);
  React.useEffect(() => {
    if (autoEnteredRef.current || !roomJoined) return;
    const hasCharacter =
      new URLSearchParams(window.location.search).has("avatar") ||
      !!localStorage.getItem("strndd-avatar_index");
    if (!hasCharacter) return; // new user -> let them design their character
    let tries = 0;
    const timer = setInterval(() => {
      const canvas = canvasCompleteHiddenRef.current;
      // ready once the composite canvas has non-trivial pixel data (avatar drawn)
      const ready = !!canvas && canvas.toDataURL("image/png").length > 5000;
      if (ready || tries++ > 40) {
        clearInterval(timer);
        if (autoEnteredRef.current) return;
        autoEnteredRef.current = true;
        formRef.current?.requestSubmit();
      }
    }, 100);
    return () => clearInterval(timer);
  }, [roomJoined]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    //console.log("handleSubmit");
    event.preventDefault();
    if (name === "") {
      setNameFieldEmpty(true);
    } else if (roomJoined) {
      localStorage.setItem("name", name);
      // upload avatar, complete (which is the avatar put in a row of sprites)
      const canvasComplete = canvasCompleteHiddenRef.current;
      const context = canvasComplete?.getContext("2d");
      if (context) {
        const formData = new FormData();
        // submit to django
        // all
        // if (canvas) {
        // formData.append("image", canvas?.toDataURL("image/png"))
        // }
        // complete
        if (canvasComplete) {
          formData.append("complete", canvasComplete?.toDataURL("image/png"));
        }
        // complete
        // set is loading to true after canvas is drawn
        setIsLoading(true);
        // Load the composited character spritesheet straight from the canvas —
        // no backend upload needed (the Django image service was removed).
        const uuid = uuidv4();
        const dataURL = canvasComplete.toDataURL("image/png");
        localStorage.setItem(
          "strndd-avatar_index",
          JSON.stringify({
            Bodies: avatarStyleIndex.Bodies,
            Accessories: avatarStyleIndex.Accessories,
            Bodies_kids: avatarStyleIndex.Bodies_kids,
            Outfits_kids: avatarStyleIndex.Outfits_kids,
            Books: avatarStyleIndex.Books,
            Outfits: avatarStyleIndex.Outfits,
            Hairstyles: avatarStyleIndex.Hairstyles,
            Smartphones: avatarStyleIndex.Smartphones,
            Eyes: avatarStyleIndex.Eyes,
            Hairstyles_kids: avatarStyleIndex.Hairstyles_kids,
            Eyes_kids: avatarStyleIndex.Eyes_kids,
          })
        );
        localStorage.setItem("strndd-avatar_name", name);
        // Phaser's loader rejects data: URIs, so add the sprite sheet to the
        // texture manager directly from an <img> built from the canvas.
        const spriteImg = new Image();
        spriteImg.onload = () => {
          if (!game.textures.exists(uuid)) {
            game.textures.addSpriteSheet(uuid, spriteImg as any, {
              frameWidth: 32,
              frameHeight: 48,
            });
          }
          setIsLoading(false);
          game.registerKeys();
          for (let i = 0; i < Object.keys(FRAMES).length; i++) {
            game.anims.create({
              key: `${uuid}_${Object.keys(FRAMES)[i]}`,
              frames: game.anims.generateFrameNames(uuid, {
                start: FRAMES[Object.keys(FRAMES)[i]].start,
                end: FRAMES[Object.keys(FRAMES)[i]].end,
              }),
              repeat: FRAMES[Object.keys(FRAMES)[i]].repeat,
              frameRate: FRAMES[Object.keys(FRAMES)[i]].frameRate,
            });
          }
          game.myPlayer.setPlayerName(name);
          game.myPlayer.setPlayerTexture(uuid);
          game.anims.play(`${uuid}_idle_down`, game.myPlayer);
          // Share the avatar recipe so peers render this exact character (they
          // composite it locally under the same `uuid` key -> anim names match).
          game.network.updatePlayerAvatar(
            JSON.stringify({ key: uuid, index: avatarStyleIndex })
          );
          game.network.readyToConnect();
          dispatch(setLoggedIn(true));
        };
        spriteImg.onerror = () => {
          setIsLoading(false);
          // Fall back to a default avatar so the user can still join.
          game.registerKeys();
          game.myPlayer.setPlayerName(name);
          game.myPlayer.setPlayerTexture(avatars[avatarIndex].name);
          game.network.readyToConnect();
          dispatch(setLoggedIn(true));
        };
        spriteImg.src = dataURL;
      }
    }
  };

  return (
    <Wrapper onSubmit={handleSubmit} ref={formRef}>
      <Content>
        <Left>
          <>
            {/* Name is taken from the account (?name=<username>), not typed here —
                the field was removed. handleSubmit still uses the `name` state. */}
            <canvas
              ref={canvasRef}
              height={CANVAS.height}
              width={CANVAS.width}
            />
            <canvas
              hidden={true}
              ref={canvasCompleteHiddenRef}
              height={CANVAS_COMPLETE_HIDDEN.height}
              width={CANVAS_COMPLETE_HIDDEN.width}
            />

            <Stack
              direction="row"
              sx={{
                justifyContent: "center",
                alignItems: "center",
                mt: 2,
              }}
            >
              <IconButton
                onClick={() => {
                  if (avatarStyleIndex.Hairstyles > 0) {
                    setAvatarStyleIndex({
                      ...avatarStyleIndex,
                      Hairstyles: avatarStyleIndex.Hairstyles - 1,
                    });
                  } else {
                    setAvatarStyleIndex({
                      ...avatarStyleIndex,
                      Hairstyles: AVATAR_STYLES.Hairstyles.length - 1,
                    });
                  }
                }}
              >
                <ArrowLeftIcon />{" "}
              </IconButton>
              <Box
                style={{
                  color: "#c2c2c2",
                  fontSize: "12px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  width: "100px",
                  textAlign: "center",
                }}
              >
                Hair
              </Box>
              <IconButton
                onClick={() => {
                  if (
                    avatarStyleIndex.Hairstyles <
                    AVATAR_STYLES.Hairstyles.length - 1
                  ) {
                    setAvatarStyleIndex({
                      ...avatarStyleIndex,
                      Hairstyles: avatarStyleIndex.Hairstyles + 1,
                    });
                  } else {
                    setAvatarStyleIndex({
                      ...avatarStyleIndex,
                      Hairstyles: 0,
                    });
                  }
                }}
              >
                <ArrowRightIcon />{" "}
              </IconButton>
            </Stack>
            <Stack
              direction="row"
              sx={{
                justifyContent: "center",
                alignItems: "center",
                mt: 0,
              }}
            >
              <IconButton
                onClick={() => {
                  if (avatarStyleIndex.Accessories > 0) {
                    setAvatarStyleIndex({
                      ...avatarStyleIndex,
                      Accessories: avatarStyleIndex.Accessories - 1,
                    });
                  } else {
                    setAvatarStyleIndex({
                      ...avatarStyleIndex,
                      Accessories: AVATAR_STYLES.Accessories.length - 1,
                    });
                  }
                }}
              >
                <ArrowLeftIcon />{" "}
              </IconButton>
              <Box
                style={{
                  color: "#c2c2c2",
                  fontSize: "12px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  width: "100px",
                  textAlign: "center",
                }}
              >
                Accessories
              </Box>
              <IconButton
                onClick={() => {
                  if (
                    avatarStyleIndex.Accessories <
                    AVATAR_STYLES.Accessories.length - 1
                  ) {
                    setAvatarStyleIndex({
                      ...avatarStyleIndex,
                      Accessories: avatarStyleIndex.Accessories + 1,
                    });
                  } else {
                    setAvatarStyleIndex({
                      ...avatarStyleIndex,
                      Accessories: 0,
                    });
                  }
                }}
              >
                <ArrowRightIcon />{" "}
              </IconButton>
            </Stack>
            <Stack
              direction="row"
              sx={{
                justifyContent: "center",
                alignItems: "center",
                mt: 0,
              }}
            >
              <IconButton
                onClick={() => {
                  if (avatarStyleIndex.Eyes > 0) {
                    setAvatarStyleIndex({
                      ...avatarStyleIndex,
                      Eyes: avatarStyleIndex.Eyes - 1,
                    });
                  } else {
                    setAvatarStyleIndex({
                      ...avatarStyleIndex,
                      Eyes: AVATAR_STYLES.Eyes.length - 1,
                    });
                  }
                }}
              >
                <ArrowLeftIcon />{" "}
              </IconButton>
              <Box
                style={{
                  color: "#c2c2c2",
                  fontSize: "12px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  width: "100px",
                  textAlign: "center",
                }}
              >
                Eyes
              </Box>
              <IconButton
                onClick={() => {
                  if (avatarStyleIndex.Eyes < AVATAR_STYLES.Eyes.length - 1) {
                    setAvatarStyleIndex({
                      ...avatarStyleIndex,
                      Eyes: avatarStyleIndex.Eyes + 1,
                    });
                  } else {
                    setAvatarStyleIndex({
                      ...avatarStyleIndex,
                      Eyes: 0,
                    });
                  }
                }}
              >
                <ArrowRightIcon />{" "}
              </IconButton>
            </Stack>
            <Stack
              direction="row"
              sx={{
                justifyContent: "center",
                alignItems: "center",
                mt: 0,
              }}
            >
              <IconButton
                onClick={() => {
                  if (avatarStyleIndex.Bodies > 0) {
                    setAvatarStyleIndex({
                      ...avatarStyleIndex,
                      Bodies: avatarStyleIndex.Bodies - 1,
                    });
                  } else {
                    setAvatarStyleIndex({
                      ...avatarStyleIndex,
                      Bodies: AVATAR_STYLES.Bodies.length - 1,
                    });
                  }
                }}
              >
                <ArrowLeftIcon />{" "}
              </IconButton>
              <Box
                style={{
                  color: "#c2c2c2",
                  fontSize: "12px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  width: "100px",
                  textAlign: "center",
                }}
              >
                Body
              </Box>
              <IconButton
                onClick={() => {
                  if (
                    avatarStyleIndex.Bodies <
                    AVATAR_STYLES.Bodies.length - 1
                  ) {
                    setAvatarStyleIndex({
                      ...avatarStyleIndex,
                      Bodies: avatarStyleIndex.Bodies + 1,
                    });
                  } else {
                    setAvatarStyleIndex({
                      ...avatarStyleIndex,
                      Bodies: 0,
                    });
                  }
                }}
              >
                <ArrowRightIcon />{" "}
              </IconButton>
            </Stack>
            <Stack
              direction="row"
              sx={{
                justifyContent: "center",
                alignItems: "center",
                mt: 0,
              }}
            >
              <IconButton
                onClick={() => {
                  if (avatarStyleIndex.Outfits > 0) {
                    setAvatarStyleIndex({
                      ...avatarStyleIndex,
                      Outfits: avatarStyleIndex.Outfits - 1,
                    });
                  } else {
                    setAvatarStyleIndex({
                      ...avatarStyleIndex,
                      Outfits: AVATAR_STYLES.Outfits.length - 1,
                    });
                  }
                }}
              >
                <ArrowLeftIcon />{" "}
              </IconButton>
              <Box
                style={{
                  color: "#c2c2c2",
                  fontSize: "12px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  width: "100px",
                  textAlign: "center",
                }}
              >
                Outfit
              </Box>
              <IconButton
                onClick={() => {
                  if (
                    avatarStyleIndex.Outfits <
                    AVATAR_STYLES.Outfits.length - 1
                  ) {
                    setAvatarStyleIndex({
                      ...avatarStyleIndex,
                      Outfits: avatarStyleIndex.Outfits + 1,
                    });
                  } else {
                    setAvatarStyleIndex({
                      ...avatarStyleIndex,
                      Outfits: 0,
                    });
                  }
                }}
              >
                <ArrowRightIcon />{" "}
              </IconButton>
            </Stack>
          </>
        </Left>
        {!videoConnected && !isMobile && (
          <Right>
            <Warning>
              <Alert variant="outlined" severity="warning">
                <AlertTitle>Warning</AlertTitle>
                No webcam/mic connected -{" "}
                <strong>connect one for best experience!</strong>
              </Alert>
              <Button
                variant="outlined"
                color="secondary"
                onClick={() => {
                  game.network.webRTC?.getUserMedia();
                }}
              >
                Connect Webcam
              </Button>
            </Warning>
          </Right>
        )}
      </Content>
      <Bottom>
        <Button
          variant="contained"
          color="secondary"
          size="large"
          type="submit"
        >
          Join
        </Button>
      </Bottom>
      <canvas
        hidden={true}
        ref={canvasHiddenRef}
        height={CANVAS_HIDDEN.height}
        width={CANVAS_HIDDEN.width}
      />

      <Backdrop
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={isLoading}
        onClick={handleClose}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
    </Wrapper>
  );
}
