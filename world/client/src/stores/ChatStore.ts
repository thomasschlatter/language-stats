import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { IChatMessage } from "../../../types/IOfficeState";
import phaserGame from "../PhaserGame";
import Game from "../scenes/Game";

export enum MessageType {
  PLAYER_JOINED,
  PLAYER_LEFT,
  REGULAR_MESSAGE,
}

// Flavour text for join/leave, themed per world (island keeps the original
// "washed ashore"). Falls back to plain "joined"/"left" for unknown worlds.
const JOIN_PHRASE: Record<string, string> = {
  meadow: "wandered into the meadow",
  village: "strolled into the village",
  island: "washed ashore",
  cafe: "stepped into the café",
  town: "arrived downtown",
  osaka: "arrived in Osaka",
};
const LEAVE_PHRASE: Record<string, string> = {
  meadow: "wandered off",
  village: "headed home",
  island: "swam away",
  cafe: "headed out",
  town: "left downtown",
  osaka: "left Osaka",
};

function currentWorldMap(): string {
  try {
    const game = phaserGame.scene.keys.game as Game;
    return (game as any)?.network?.worldMap || "meadow";
  } catch {
    return "meadow";
  }
}

export const chatSlice = createSlice({
  name: "chat",
  initialState: {
    chatMessages: new Array<{
      messageType: MessageType;
      chatMessage: IChatMessage;
    }>(),
    focused: false,
    showChat: true,
  },
  reducers: {
    pushChatMessage: (state, action: PayloadAction<IChatMessage>) => {
      state.chatMessages.push({
        messageType: MessageType.REGULAR_MESSAGE,
        chatMessage: action.payload,
      });
    },
    pushPlayerJoinedMessage: (state, action: PayloadAction<string>) => {
      state.chatMessages.push({
        messageType: MessageType.PLAYER_JOINED,
        chatMessage: {
          createdAt: new Date().getTime(),
          author: action.payload,
          content: JOIN_PHRASE[currentWorldMap()] || "joined",
        } as IChatMessage,
      });
    },
    pushPlayerLeftMessage: (state, action: PayloadAction<string>) => {
      state.chatMessages.push({
        messageType: MessageType.PLAYER_LEFT,
        chatMessage: {
          createdAt: new Date().getTime(),
          author: action.payload,
          content: LEAVE_PHRASE[currentWorldMap()] || "left",
        } as IChatMessage,
      });
    },
    setFocused: (state, action: PayloadAction<boolean>) => {
      const game = phaserGame.scene.keys.game as Game;
      action.payload ? game.disableKeys() : game.enableKeys();
      state.focused = action.payload;
    },
    setShowChat: (state, action: PayloadAction<boolean>) => {
      state.showChat = action.payload;
    },
  },
});

export const {
  pushChatMessage,
  pushPlayerJoinedMessage,
  pushPlayerLeftMessage,
  setFocused,
  setShowChat,
} = chatSlice.actions;

export default chatSlice.reducer;
