import React from "react";
import Autosuggest from "react-autosuggest";

function getSuggestionValue(suggestion) {
	return suggestion.username;
}

function renderSuggestion(suggestion) {
	return (
		<div>{suggestion.username} ({suggestion.realname})</div>
	);
}

class UserFinder extends React.Component {
	constructor() {
		super();
		this.state = {value: ''};
		this.lastRequestId = null;

		this.onChange = this.onChange.bind(this);
		this.onSuggestionsFetchRequested = this.onSuggestionsFetchRequested.bind(this);
		this.onSuggestionSelected = this.onSuggestionSelected.bind(this);
	}

	onChange(event, { newValue }) {
		this.setState({value: newValue});
	};

	onSuggestionsFetchRequested(event) {
		// This is called every time the search box is updated by Autosuggest.
		// Given keystrokes happen fairly quickly, it's wasteful to send a 
		// message multiple times per second, especially when subsequent responses
		// invalidate prior ones. Therefore, when a key is pressed, we set
		// the actual request to happen after a certain amount of time via
		// setTimeout, and cancel previous timers; this means that in effect, 
		// the request only happens after the user stops typing.

		// Cancel the previous request
		if (this.lastRequestId !== null) {
			clearTimeout(this.lastRequestId);
		}

		// Schedule the new request
		this.lastRequestId = setTimeout(() => {
			this.props.requestUserSuggestions(event.value);
		}, 500);
	};

	onSuggestionSelected(event, {suggestion}) {
		this.setState({value: ''});
		this.props.startChat(suggestion.userid);
	}

	render() {
		const { value } = this.state;
		const inputProps = {
			placeholder: "Find a username...",
			value,
			onChange: this.onChange
		};

		return (
			<div>
				<Autosuggest 
					suggestions={this.props.suggestions}
					onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
					onSuggestionsClearRequested={this.props.onSuggestionsClearRequested}
					onSuggestionSelected={this.onSuggestionSelected}
					getSuggestionValue={getSuggestionValue}
					renderSuggestion={renderSuggestion}
					inputProps={inputProps} 
				/>
			</div>
		);
	}
}

export { UserFinder } ;
