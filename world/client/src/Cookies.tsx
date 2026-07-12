import React from 'react';

const Cookies = () => {

    const serviceName = 'Strndd';
    const websiteName = 'strndd.com';
    const websiteURL = 'https://strndd.com';
    const companyName = 'Groupifier, LLC';
    const companyNameShort = 'Groupifier';
    const contactEmail = 'admin@strndd.com';

    return (
        <div>
            <h1>{websiteName} Cookie Policy</h1>
            <p>This Cookie Policy explains how {websiteName} ("we", "us", or "our") uses cookies and similar technologies to collect
                and store information when you visit our website or use our services ("Services").</p>
            <h2>1. WHAT ARE COOKIES?</h2>
            <p>Cookies are small text files that are sent to and stored on your device (computer, tablet, or mobile phone) when you
                visit a website. They are widely used to make websites work or to improve the efficiency of a website, as well as
                to provide reporting information and assist with personalized advertising.</p>
            <h2>2. TYPES OF COOKIES WE USE</h2>
            <h3>2.1 Essential Cookies</h3>
            <p>These cookies are necessary for the functioning of the Services and enable you to navigate the website and use its
                features, such as accessing secure areas of the website.</p>
            <h3>2.2 Analytics Cookies</h3>
            <p>These cookies allow us to collect data on how visitors use our website, including the number of visitors, the
                websites that referred them to our website, and the pages they visited. This information helps us improve the
                performance and usability of our website.</p>
            <h3>2.3 Advertising Cookies</h3>
            <p>These cookies are used to deliver targeted advertisements that are relevant to your interests based on your browsing
                history and online behavior. They also help us measure the effectiveness of our advertising campaigns.</p>
            <h3>2.4 Third-Party Cookies</h3>
            <p>We may also allow third-party service providers, such as analytics and advertising partners, to place cookies on
                your device to collect information on your behalf. These third-party cookies are subject to the respective
                third-party's privacy policies.</p>
            <h2>3. YOUR CHOICES</h2>
            <p>You can choose to accept or decline cookies by changing your browser settings. Most web browsers automatically
                accept cookies, but you can usually modify your browser setting to decline cookies if you prefer. Please note
                that disabling cookies may affect the functionality of the Services.</p>
            <h2>4. UPDATES TO THIS COOKIE POLICY</h2>
            <p>We may update this Cookie Policy from time to time by posting the updated version on the Site or through the
                Services. The updated version will be effective as of the date of posting. We encourage you to review this Cookie
                Policy periodically for any changes.</p>
            <h2>5. CONTACT US</h2>
            <p>If you have any questions or concerns about this Cookie Policy, please contact us at [contact email or address].</p>
        </div>
    );
};

export default Cookies;
