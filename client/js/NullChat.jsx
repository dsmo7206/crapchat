import React from "react";

// This class is shown in the main chat pane when no Chat is selected

class NullChat extends React.Component {
    render() {
        return (
            <div className="nullchat">
                <p>Please select a chat</p>
            </div>
        );
    }
}

export { NullChat };
