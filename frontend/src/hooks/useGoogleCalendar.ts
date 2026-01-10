import { useEffect, useState } from 'react';

export const useGoogleCalendar = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if Google Calendar script is already loaded
    if (typeof window !== 'undefined' && (window as any).calendar?.schedulingButton) {
      setIsLoaded(true);
      return;
    }

    // Load the CSS and JS for Google Calendar
    const loadGoogleCalendar = async () => {
      if (isLoading) return;
      setIsLoading(true);

      try {
        // Load CSS
        if (!document.querySelector('link[href*="calendar.google.com/calendar/scheduling-button-script.css"]')) {
          const link = document.createElement('link');
          link.href = 'https://calendar.google.com/calendar/scheduling-button-script.css';
          link.rel = 'stylesheet';
          document.head.appendChild(link);
        }

        // Load JS
        if (!document.querySelector('script[src*="calendar.google.com/calendar/scheduling-button-script.js"]')) {
          const script = document.createElement('script');
          script.src = 'https://calendar.google.com/calendar/scheduling-button-script.js';
          script.async = true;
          
          script.onload = () => {
            setIsLoaded(true);
            setIsLoading(false);
          };
          
          script.onerror = () => {
            console.error('Failed to load Google Calendar script');
            setIsLoading(false);
          };
          
          document.body.appendChild(script);
        }
      } catch (error) {
        console.error('Error loading Google Calendar:', error);
        setIsLoading(false);
      }
    };

    loadGoogleCalendar();
  }, [isLoading]);

  const initializeButton = (targetElement: HTMLElement) => {
    if (!isLoaded || !targetElement) return;

    // Clear any existing content
    targetElement.innerHTML = '';

    try {
      (window as any).calendar?.schedulingButton?.load({
        url: 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ2CdfmVUn7z34dUbeDBicdu_tEAnq1S1-g4GPPmq4bVCk7SoY-LNr5KoXi2IOfWFUl3HZ1N7DyA?gv=true',
        color: '#039BE5',
        label: 'Book an appointment',
        target: targetElement,
      });
    } catch (error) {
      console.error('Error initializing Google Calendar button:', error);
    }
  };

  return { isLoaded, isLoading, initializeButton };
};