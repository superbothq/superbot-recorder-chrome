import React from "react";
import { observable } from "mobx";
import { observer } from "mobx-react";
import { DragDropContext } from "react-dnd";
import HTML5Backend from "react-dnd-html5-backend";
import ProjectStore from "../../stores/domain/ProjectStore";
import seed from "../../stores/seed";
import modify from "../../side-effects/modify";
import OmniBar from "../../components/OmniBar";
import ProjectHeader from "../../components/ProjectHeader";
import Navigation from "../Navigation";
import Editor from "../Editor";
import Console from "../Console";
import UiState from "../../stores/view/UiState";
import "../../styles/app.css";
import "../../styles/heights.css";

import Alert from "../../components/Alert";
import TestSelector from "../../components/TestSelector";

const project = observable(new ProjectStore());

if (process.env.NODE_ENV !== "production") {
  seed(project);
}

modify(project);

@DragDropContext(HTML5Backend)
@observer export default class Panel extends React.Component {
  constructor(props) {
    super(props);
    this.state = { project };
    this.moveTest = this.moveTest.bind(this);
    this.deleteTest = this.deleteTest.bind(this);
  }
  moveTest(testItem, toSuite) {
    const destination = this.state.project.suites.find((suite) => (suite.id === toSuite));
    const origin = this.state.project.suites.find((suite) => (suite.id === testItem.suite));
    const test = origin.tests.find(test => (test.id === testItem.id));

    destination.addTestCase(test);
    origin.removeTestCase(test);
  }
  deleteTest(testCase) {
    this.show({
      title: testCase.name,
      description: `This will permanently delete '${testCase.name}', and remove it from all it's suites`,
      cancelLabel: "cancel",
      confirmLabel: "delete"
    }, (choseDelete) => {
      if (choseDelete) {
        this.state.project.deleteTestCase(testCase);
      }
    });
  }
  selectTestsForSuite(suite, tests) {
    suite.replaceTestCases(tests);
    UiState.editSuite(null);
  }
  render() {
    return (
      <div>
        <OmniBar />
        <ProjectHeader title={this.state.project.name} changed={this.state.project.modified} changeName={this.state.project.changeName} />
        <div style={{
          float: "left"
        }}>
          <Navigation tests={this.state.project.tests} suites={this.state.project.suites} removeSuite={this.state.project.deleteSuite} moveTest={this.moveTest} deleteTest={this.deleteTest} />
        </div>
        <Editor test={UiState.selectedTest ? this.state.project.tests.find(test => (test.id === UiState.selectedTest)) : null} />
        <div style={{
          clear: "left"
        }}></div>
        <Console />
        <Alert show={show => this.show = show} />
        {UiState.editedSuite ? <TestSelector tests={this.state.project.tests} completeSelection={tests => this.selectTestsForSuite.bind(this, UiState.editedSuite, tests)} /> : null}
      </div>
    );
  }
}
