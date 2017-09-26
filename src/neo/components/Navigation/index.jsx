import React from "react";
import PropTypes from "prop-types";
import ProjectList from "../ProjectList";
import Runs from "../Runs";

export default class Navigation extends React.Component {
  static propTypes = {
    projects: PropTypes.array.isRequired,
    selectedTest: PropTypes.string,
    selectTest: PropTypes.func.isRequired
  };
  render() {
    return (
      <aside>
        <h3>Test Case</h3>
        <ProjectList projects={this.props.projects} selectedTest={this.props.selectedTest} selectTest={this.props.selectTest} />
        <Runs />
      </aside>
    );
  }
}
