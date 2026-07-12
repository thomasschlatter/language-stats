import React from 'react';

const Disclaimer = () => {

    const serviceName = 'Strndd';
    const websiteName = 'strndd.com';
    const websiteURL = 'https://strndd.com';
    const companyName = 'Groupifier, LLC';
    const companyNameShort = 'Groupifier';
    const contactEmail = 'admin@strndd.com';

    return (
        <div>
            <h1>{websiteName} Disclaimer</h1>
            <p>The information provided on {websiteName} (the "Website") is for general informational purposes only. The Website
                owner and authors do not make any warranties, representations, or guarantees of any kind, express or implied,
                about the accuracy, completeness, reliability, suitability, or availability of the information contained on the
                Website. Any reliance you place on such information is strictly at your own risk.</p>
            <h2>1. Medical Disclaimer</h2>
            <p>The content on the Website is not intended to be a substitute for professional medical advice, diagnosis, or
                treatment. Always seek the advice of your physician or other qualified health provider with any questions you may
                have regarding a medical condition. Never disregard professional medical advice or delay in seeking it because of
                something you have read on the Website.</p>
            <h2>2. Financial and Legal Disclaimer</h2>
            <p>The information on the Website is not intended to be a substitute for professional financial or legal advice. The
                Website owner and authors do not provide financial or legal advice and make no representations or warranties
                regarding the accuracy, reliability, or suitability of the financial or legal information provided on the
                Website. Always seek the advice of qualified professionals for financial or legal matters.</p>
            <h2>3. External Links Disclaimer</h2>
            <p>The Website may contain links to external websites that are not owned or operated by the Website owner. The
                Website owner and authors do not have control over the content, accuracy, or reliability of these external
                websites. The inclusion of any links does not necessarily imply endorsement or recommendation of the views
                expressed within them.</p>
            <h2>4. Liability Disclaimer</h2>
            <p>In no event shall the Website owner or authors be liable for any direct, indirect, incidental, consequential,
                special, or exemplary damages arising out of or in connection with the use of the Website or the information
                contained on the Website, regardless of the form of action, even if they have been advised of the possibility of
                such damages.</p>
            <h2>5. Changes to the Disclaimer</h2>
            <p>The Website owner and authors reserve the right to modify, update, or change this Disclaimer at any time without
                prior notice. It is your responsibility to review this Disclaimer periodically for any changes.</p>
            <h2>6. Contact Us</h2>
            <p>If you have any questions or concerns about this Disclaimer, please contact us at [contact email or address].</p>

        </div>
    );
};

export default Disclaimer;
