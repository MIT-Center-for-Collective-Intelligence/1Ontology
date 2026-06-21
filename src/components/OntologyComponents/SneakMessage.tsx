/* # SneakMessage Component

The `SneakMessage` component is a React component that utilizes the Material-UI `Snackbar` component to display a temporary and dismissible message to the user. It is designed to show notifications or alerts that do not require user interaction to disappear.

## Props

The component accepts the following props:

- `newMessage`: A `string` that represents the message to be displayed in the Snackbar.
- `setNewMessage`: A function that updates the state of the message, typically to reset it after being displayed.

## Usage

To use the `SneakMessage` component, you need to import it into your React component and provide it with the required props.

```jsx
import SneakMessage from './SneakBarMessage';

// In your component
const [newMessage, setNewMessage] = useState('');

// Render the SneakMessage component
<SneakMessage newMessage={newMessage} setNewMessage={setNewMessage} />
```

## Behavior

When the `newMessage` prop changes and is not an empty string, the Snackbar will open with the new message. The message will automatically disappear after 4000 milliseconds (4 seconds), or it can be dismissed earlier by the user by clicking away from the Snackbar.

## State

The component maintains its own state:

- `open`: A `boolean` that determines whether the Snackbar is visible or not.
- `message`: A `string` that holds the current message to be displayed.

## Effects

The component uses a `useEffect` hook to listen for changes to the `newMessage` prop. When `newMessage` is updated, the component will:

1. Set the `open` state to `true` to show the Snackbar.
2. Update the `message` state with the new message.
3. Call the `setNewMessage` prop function with an empty string to reset the message state in the parent component.

## Handlers

The `close` function is used as a callback for the `onClose` event of the Snackbar. It prevents the Snackbar from closing if the reason for the close event is a click away from the Snackbar. Otherwise, it sets the `open` state to `false`, which hides the Snackbar.

## Component Return

The component returns the Material-UI `Snackbar` component with the following props:

- `open`: Controlled by the component's `open` state.
- `autoHideDuration`: Set to 4000 milliseconds.
- `onClose`: Set to the `close` function.
- `message`: The current message to be displayed, controlled by the component's `message` state
 */
import { Alert } from "@mui/material";
import Snackbar from "@mui/material/Snackbar";
import React, { useEffect, useState } from "react";

type ISneakMessageProps = {
  newMessage: string;
  setNewMessage: (message: string) => void;
};

const SneakMessage = (props: ISneakMessageProps) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(props.newMessage);

  useEffect(() => {
    if (props.newMessage) {
      setOpen(true);
      setMessage(props.newMessage);
      props.setNewMessage("");
    }
  }, [props.newMessage]);

  const close = (event: any, reason: any) => {
    if (reason === "clickaway") {
      return;
    }
    setOpen(false);
  };

  return (
    <Snackbar
      open={open}
      autoHideDuration={3000}
      onClose={close}
      message={<span style={{ fontSize: "16px", padding: 0 }}>{message}</span>}
      sx={{ margin: 0 }}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
    />
  );
};

export default SneakMessage;
