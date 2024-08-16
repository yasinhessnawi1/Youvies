import React, { useEffect, useState } from 'react';
import '../../styles/components/Footer.css'; // This is where you will add your styles

const Footer = () => {
    const [activeIndex, setActiveIndex] = useState(0);
    const items = [
        {
            title: 'Important Information',
            description: `This webpage is 100% free and does not initially include ads. The only ads you might encounter are within the video player, and they are not affiliated with our website. 
                To enjoy an ad-free experience, we recommend using an ad blocker. You can install the "AdGuard AdBlocker" extension by clicking <a href="https://chromewebstore.google.com/detail/adguard-adblocker/bgnkhhnnamicmpeenaelnjfhikgbkllg" target="_blank" class="footer-link">here</a>.`,
        },
        {
            title: 'User Notice',
            description: 'Please note that we are not responsible for the content of the ads displayed within the video player, nor are we responsible for the content of the videos themselves. Viewer discretion is advised.',
        },
        {
            title: 'Beta Version Alert',
            description: 'You are currently using a beta version of our website. This means some features may not function as intended, and not all planned features are currently available. We appreciate your patience and invite you to report any bugs you encounter to help us improve.',
        },
        {
            title: 'User Account Alert',
            description: 'As this is a Beta version your user account could be lost due changes in the database.',
        },
        {
            title: 'Content Info',
            description: 'We have a good collection of many items but we dont have everything. Stay tuned to watch more.',
        },

    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveIndex((prevIndex) => (prevIndex + 1) % items.length);
        }, 15000); // Switch items every 15 seconds

        return () => clearInterval(interval);
    }, [items.length]);

    return (
        <footer className="footer-container">

            <div className="footer-carousel">
                {items.map((item, index) => (
                    <div
                        className={`card ${index === activeIndex ? 'active' : ''}`}
                        key={index}
                    >
                        <p className="card-title">{item.title}</p>
                        <p
                            className="card-des"
                            dangerouslySetInnerHTML={{__html: item.description}}
                        />
                    </div>
                ))}
            </div>
            <div className="footer-info">
                <h4>Youvies.Online</h4>
                <p>Copyright © All Rights Reserved
                    This site does not store any files on its server. All contents are provided by non-affiliated third parties.</p>
                <div className="footer-links">
                    <a href="#" className="footer-link">About Us</a>
                    <a href="#" className="footer-link">Contact</a>
                    <a href="#" className="footer-link">Privacy Policy</a>
                </div>
            </div>

        </footer>
    );
};

export default Footer;
