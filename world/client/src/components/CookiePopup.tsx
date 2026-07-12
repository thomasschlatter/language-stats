import React, { useEffect, useState } from "react";
import { styled } from "@mui/material/styles";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import muiTheme from "../MuiTheme";

const CookiePopup = () => {
    const [accepted, setAccepted] = useState(false);

    const handleAccept = () => {
        setAccepted(true);
        // Set cookie that says the user has accepted   
        localStorage.setItem("cookie-accepted", "true");
    };

    useEffect(() => {
        // Check if the user has already accepted the cookie popup
        const cookieAccepted = localStorage.getItem("cookie-accepted");
        if (cookieAccepted) {
            setAccepted(true);
        }
    }, []);

    return (
        <>
            {!accepted && (
                <CookiePopupContainer>
                    <p>This website uses cookies. By continuing to use the site, you agree to the use of cookies.</p>
                    <p> You can find more information about our use of cookies in our <a href="/cookies">Cookie Policy</a>.</p>
                    <p> By continuing to use the site, you agree to the terms of our <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.</p>
                    <p> You have to be at least 18 years old to use this website.</p>
                    <AcceptButton variant="contained" color="primary" onClick={handleAccept}>
                        Accept
                    </AcceptButton>
                </CookiePopupContainer>
            )}
        </>
    );
};

const CookiePopupContainer = styled(Paper)(({ theme }) => ({
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#2596be",
    padding: theme.spacing(2),
    textAlign: "center",
    zIndex: 9999,
}));

const AcceptButton = styled(Button)({
    marginTop: "16px",
});

export default CookiePopup;
