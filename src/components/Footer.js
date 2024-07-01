

import React from 'react';

function Footer() {
    return (
        <div className={"container"}>
            <p>© 2024 ElectroMart, Inc. All rights reserved.</p>
            <div className={"social-icons"}>
                <a href='#' aria-label='Facebook'>
                    <i className='fa fa-facebook'></i>
                </a>
                <a href='#' aria-label='Twitter'>
                    <i className='fa fa-twitter'></i>
                </a>
                <a href='#' aria-label='Instagram'>
                    <i className='fa fa-instagram'></i>
                </a>
            </div>
        </div>
    );
}

export default Footer;
