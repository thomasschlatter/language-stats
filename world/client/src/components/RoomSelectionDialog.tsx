import { useRef, useState } from "react";
import styled from "styled-components";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import LinearProgress from "@mui/material/LinearProgress";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { CustomRoomTable } from "./CustomRoomTable";
import { CreateRoomForm } from "./CreateRoomForm";
import { useAppSelector } from "../hooks";
import { WORLDS, WorldInfo } from "../../../types/Rooms";

import phaserGame from "../PhaserGame";
import Bootstrap from "../scenes/Bootstrap";
import CookiePopup from "./CookiePopup";
import store from "../stores";
import { setRoomLanguage } from "../stores/RoomStore";

// "de-DE" -> "German" (built-in, no lookup table). Falls back to the raw code.
function languageDisplayName(code?: string): string {
  if (!code) return "";
  try {
    const base = code.split("-")[0];
    const DN = (Intl as any).DisplayNames;
    if (!DN) return code;
    return new DN([navigator.language || "en"], { type: "language" }).of(base) || code;
  } catch {
    return code;
  }
}

const Backdrop = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  gap: 60px;
  align-items: center;
`;

const Wrapper = styled.div`
  background: #222639;
  border-radius: 16px;
  padding: 36px 60px;
  box-shadow: 0px 0px 5px #0000006f;
  width: 600px;
`;

const CustomRoomWrapper = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
  justify-content: center;

  .tip {
    font-size: 18px;
  }
`;

const TitleWrapper = styled.div`
  display: grid;
  width: 100%;

  .back-button {
    grid-column: 1;
    grid-row: 1;
    justify-self: start;
    align-self: center;
  }

  h1 {
    grid-column: 1;
    grid-row: 1;
    justify-self: center;
    align-self: center;
  }
`;

const Title = styled.h1`
  font-size: 50px;
  color: #eee;
  text-align: center;
`;

const WorldGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  width: 100%;
`;

// Vertical stack for the picker (world grid + buttons) with a uniform gap.
const PickerStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  margin-top: 12px;
`;

const WorldCard = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  background: #2c3050;
  border: 1px solid #3a3f66;
  border-radius: 12px;
  padding: 14px 16px;
  cursor: pointer;
  color: #eee;
  transition: transform 0.08s ease, border-color 0.12s ease, background 0.12s ease;

  &:hover {
    background: #333858;
    border-color: #33ac96;
    transform: translateY(-2px);
  }

  .emoji {
    font-size: 34px;
    line-height: 1;
    flex-shrink: 0;
  }

  .info h3 {
    margin: 0 0 3px;
    font-size: 18px;
    color: #fff;
  }

  .info p {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.35;
    color: #b7bcda;
  }
`;

// Full-width, same padding/look as the world cards.
const PracticeButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  background: #2c3050;
  border: 1px solid #3a3f66;
  border-radius: 12px;
  padding: 14px 16px;
  cursor: pointer;
  color: #eee;
  font-size: 16px;
  font-weight: 600;
  transition: transform 0.08s ease, border-color 0.12s ease, background 0.12s ease;

  &:hover {
    background: #333858;
    border-color: #33ac96;
    transform: translateY(-2px);
  }
`;

const ProgressBarWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;

  h3 {
    color: #33ac96;
  }
`;

const ProgressBar = styled(LinearProgress)`
  width: 360px;
`;

export default function RoomSelectionDialog() {
  const [showCustomRoom, setShowCustomRoom] = useState(false);
  const [showCreateRoomForm, setShowCreateRoomForm] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const lobbyJoined = useAppSelector((state) => state.room.lobbyJoined);

  const joiningRef = useRef(false);
  const handleJoinWorld = async (world: WorldInfo) => {
    if (joiningRef.current) return; // guard against double-tap -> duplicate join
    if (!lobbyJoined) {
      setShowSnackbar(true);
      return;
    }
    joiningRef.current = true;
    // Group with others learning the same language (server filterBy). Falls back
    // to the shared bucket if the profile fetch fails or no language is set.
    let language: string | undefined;
    try {
      const me = await fetch("/api/auth/me", { credentials: "same-origin" }).then(
        (r) => (r.ok ? r.json() : null)
      );
      const learning = me?.user?.learning;
      if (learning && learning.length) language = learning[0];
    } catch {
      /* fall back to the shared bucket */
    }
    store.dispatch(setRoomLanguage(languageDisplayName(language)));
    const bootstrap = phaserGame.scene.keys.bootstrap as Bootstrap;
    bootstrap.network
      .joinWorld(world.id, world.map, language)
      .then(() => bootstrap.launchGameWithoutBackground())
      .catch((error) => { joiningRef.current = false; console.error(error); });
  };

  // Single-player mini-game — no room/Colyseus needed.
  const handlePractice = () => {
    const bootstrap = phaserGame.scene.keys.bootstrap as Bootstrap;
    bootstrap.launchPractice();
  };

  return (
    <>
      <CookiePopup />
      <Snackbar
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        open={showSnackbar}
        autoHideDuration={3000}
        onClose={() => {
          setShowSnackbar(false);
        }}
      >
        <Alert
          severity="error"
          variant="outlined"
          // overwrites the dark theme on render
          style={{ background: "#fdeded", color: "#7d4747" }}
        >
          Trying to connect to server, please try again!
        </Alert>
      </Snackbar>
      <Backdrop>
        <Wrapper>
          {showCreateRoomForm ? (
            <CustomRoomWrapper>
              <TitleWrapper>
                <IconButton
                  className="back-button"
                  onClick={() => setShowCreateRoomForm(false)}
                >
                  <ArrowBackIcon />
                </IconButton>
                <Title>Create Custom Room</Title>
              </TitleWrapper>
              <CreateRoomForm />
            </CustomRoomWrapper>
          ) : showCustomRoom ? (
            <CustomRoomWrapper>
              <TitleWrapper>
                <IconButton
                  className="back-button"
                  onClick={() => setShowCustomRoom(false)}
                >
                  <ArrowBackIcon />
                </IconButton>
                <Title>
                  Custom Rooms
                  <Tooltip
                    title="We update the results in realtime, no refresh needed!"
                    placement="top"
                  >
                    <IconButton>
                      <HelpOutlineIcon className="tip" />
                    </IconButton>
                  </Tooltip>
                </Title>
              </TitleWrapper>
              <CustomRoomTable />
              <Button
                variant="contained"
                color="secondary"
                onClick={() => setShowCreateRoomForm(true)}
              >
                Create new room
              </Button>
            </CustomRoomWrapper>
          ) : (
            <>
              <Title>Choose a world</Title>
              <PickerStack>
                <WorldGrid>
                  {WORLDS.map((world) => (
                    <WorldCard
                      key={world.id}
                      onClick={() => handleJoinWorld(world)}
                    >
                      <span className="emoji">{world.emoji}</span>
                      <div className="info">
                        <h3>{world.name}</h3>
                        <p>{world.description}</p>
                      </div>
                    </WorldCard>
                  ))}
                </WorldGrid>
                {/* Solo practice + custom-room browsing removed for now
                    (see backlog); the world grid is the only entry point. */}
              </PickerStack>
            </>
          )}
        </Wrapper>
        {!lobbyJoined && (
          <ProgressBarWrapper>
            <h3> Connecting to server...</h3>
            <ProgressBar color="secondary" />
          </ProgressBarWrapper>
        )}
      </Backdrop>
    </>
  );
}
