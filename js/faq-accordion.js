/**
 * Home Page FAQ Accordion
 * Keeps all answers closed initially and allows only one open answer at a time.
 */
document.addEventListener('DOMContentLoaded', () => {
    const accordion = document.querySelector('.faq-accordion');

    if (!accordion) {
        return;
    }

    const items = Array.from(accordion.querySelectorAll('.faq-item'));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let openItem = null;

    const getParts = (item) => ({
        button: item.querySelector('.faq-question'),
        answer: item.querySelector('.faq-answer'),
        icon: item.querySelector('.faq-icon')
    });

    const closeItem = (item, animate = true) => {
        const { button, answer, icon } = getParts(item);

        item.classList.remove('is-open');
        button.setAttribute('aria-expanded', 'false');
        icon.textContent = '+';

        if (openItem === item) {
            openItem = null;
        }

        if (answer.hidden) {
            return;
        }

        if (reduceMotion || !animate) {
            answer.hidden = true;
            answer.style.height = '';
            return;
        }

        answer.style.height = `${answer.scrollHeight}px`;
        answer.offsetHeight;
        answer.style.height = '0px';

        answer.addEventListener('transitionend', (event) => {
            if (event.propertyName === 'height' && !item.classList.contains('is-open')) {
                answer.hidden = true;
                answer.style.height = '';
            }
        }, { once: true });
    };

    const openAnswer = (item) => {
        items.forEach((otherItem) => {
            const { answer } = getParts(otherItem);

            if (otherItem !== item && !answer.hidden) {
                closeItem(otherItem, false);
            }
        });

        const { button, answer, icon } = getParts(item);

        answer.hidden = false;
        answer.style.height = '0px';
        item.classList.add('is-open');
        button.setAttribute('aria-expanded', 'true');
        icon.textContent = '−';
        openItem = item;

        if (reduceMotion) {
            answer.style.height = 'auto';
            return;
        }

        answer.offsetHeight;
        answer.style.height = `${answer.scrollHeight}px`;

        answer.addEventListener('transitionend', (event) => {
            if (event.propertyName === 'height' && item.classList.contains('is-open')) {
                answer.style.height = 'auto';
            }
        }, { once: true });
    };

    items.forEach((item) => {
        const { button, answer, icon } = getParts(item);

        item.classList.remove('is-open');
        button.setAttribute('aria-expanded', 'false');
        answer.hidden = true;
        answer.style.height = '';
        icon.textContent = '+';

        button.addEventListener('click', () => {
            if (item.classList.contains('is-open')) {
                closeItem(item);
            } else {
                openAnswer(item);
            }
        });

        button.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                event.preventDefault();
                button.click();
            }
        });
    });
});
