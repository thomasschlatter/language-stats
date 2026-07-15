import styled from "styled-components";
import { useAppSelector } from "../hooks";

const Banner = styled.div`
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  pointer-events: none;
  padding: 6px 16px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.02em;
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
`;

// A small pill at the top of the world naming the language this session groups
// same-language learners by.
export default function LanguageBanner() {
  const language = useAppSelector((state) => state.room.roomLanguage);
  if (!language) return null;
  return <Banner>🗣️ {language}</Banner>;
}
