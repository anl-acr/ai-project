import { useEffect, useRef } from "react";

/**
 * Custom hook that triggers a callback when a click occurs outside of the referenced element.
 * @param {Function} callback - Function to call on click outside.
 * @returns {React.RefObject} - Ref object to attach to the container element.
 */
export function useClickOutside(callback) {
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        callback();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [callback]);

  return ref;
}
export default useClickOutside;
