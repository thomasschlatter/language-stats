import React from "react";
import styled from "styled-components";

import { useAppSelector } from "./hooks";

import RoomSelectionDialog from "./components/RoomSelectionDialog";
import LoginDialog from "./components/LoginDialog";
import ComputerDialog from "./components/ComputerDialog";
import WhiteboardDialog from "./components/WhiteboardDialog";
import VideoConnectionDialog from "./components/VideoConnectionDialog";
import Chat from "./components/Chat";
import HelperButtonGroup from "./components/HelperButtonGroup";
import MobileVirtualJoystick from "./components/MobileVirtualJoystick";
import CharacterCreation from "./components/CharacterCreation";
import TeamTask from "./components/TeamTask";
import GameJoystick from "./components/GameJoystick";
import AnimTester from "./components/AnimTester";

const Backdrop = styled.div`
  position: absolute;
  height: 100%;
  width: 100%;
`;

function App() {
  const loggedIn = useAppSelector((state) => state.user.loggedIn);
  const computerDialogOpen = useAppSelector(
    (state) => state.computer.computerDialogOpen
  );
  const whiteboardDialogOpen = useAppSelector(
    (state) => state.whiteboard.whiteboardDialogOpen
  );
  const videoConnected = useAppSelector((state) => state.user.videoConnected);
  const roomJoined = useAppSelector((state) => state.room.roomJoined);
  const practiceMode = useAppSelector((state) => state.room.practiceMode);
  const practiceJoystick = useAppSelector((state) => state.room.practiceJoystick);

  const isMobile = window.innerWidth <= 768;

  let ui: JSX.Element;
  if (practiceMode) {
    // Single-player games: just the Phaser canvas, plus a touch joystick for the
    // movement games (Word Fall, Labyrinth).
    ui = practiceJoystick ? <GameJoystick /> : <></>;
  } else if (loggedIn) {
    if (computerDialogOpen) {
      /* Render ComputerDialog if user is using a computer. */
      ui = <ComputerDialog />;
    } else if (whiteboardDialogOpen) {
      /* Render WhiteboardDialog if user is using a whiteboard. */
      ui = <WhiteboardDialog />;
    } else {
      ui = (
        /* Render Chat or VideoConnectionDialog if no dialogs are opened. */
        <>
          <Chat />
          {/* Cooperative team task banner (shared word goal for the room). */}
          <TeamTask />
          {/* Dev overlay: click to preview each body-sheet animation. */}
          <AnimTester />
          {/* Render VideoConnectionDialog if user is not connected to a webcam. */}
          {!videoConnected && <VideoConnectionDialog />}
          <MobileVirtualJoystick />
        </>
      );
    }
  } else if (roomJoined) {
    /* Render LoginDialog if not logged in but selected a room. */
    if (isMobile) {
      ui = <CharacterCreation />;
    } else {
      ui = <CharacterCreation />;
    }
  } else {
    /* Render RoomSelectionDialog if yet selected a room. */
    ui = <RoomSelectionDialog />;
  }

  return (
    <>
      <Backdrop>
        {ui}
        {/* Render HelperButtonGroup if no dialogs are opened. */}
        {!computerDialogOpen && !whiteboardDialogOpen && !practiceMode && <HelperButtonGroup />}
      </Backdrop>
    </>
  );
}

export default App;
