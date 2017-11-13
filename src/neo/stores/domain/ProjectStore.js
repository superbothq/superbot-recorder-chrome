import { action, observable, computed } from "mobx";
import uuidv4 from "uuid/v4";
import SortBy from "sort-array";
import TestCase from "../../models/TestCase";
import Suite from "../../models/Suite";

export default class ProjectStore {
  @observable id = uuidv4();
  @observable modified = false;
  @observable name = "";
  @observable url = "";
  @observable _tests = [];
  @observable _suites = [];
  @observable _urls = [];

  constructor(name = "Untitled Project") {
    this.name = name;
    this.toJSON = this.toJSON.bind(this);
  }

  @computed get suites() {
    return SortBy(this._suites, "name");
  }

  @computed get tests() {
    return SortBy(this._tests, "name");
  }

  @computed get urls() {
    return this._urls.sort();
  }

  @action.bound setUrl(url) {
    this.url = url;
  }

  @action.bound addUrl(url) {
    this._urls.push(url);
  }

  @action.bound changeName(name) {
    this.name = name;
  }

  @action.bound setModified() {
    this.modified = true;
  }

  @action.bound createSuite(...argv) {
    const suite = new Suite(undefined, ...argv);
    this._suites.push(suite);

    return suite;
  }

  @action.bound deleteSuite(suite) {
    this._suites.remove(suite);
  }

  @action.bound createTestCase(...argv) {
    const test = new TestCase(undefined, ...argv);
    this.addTestCase(test);

    return test;
  }

  @action.bound addTestCase(test) {
    if (!test || test.constructor.name !== "TestCase") {
      throw new Error(`Expected to receive TestCase instead received ${test ? test.constructor.name : test}`);
    } else {
      this._tests.push(test);
    }
  }

  @action.bound deleteTestCase(test) {
    if (!test || test.constructor.name !== "TestCase") {
      throw new Error(`Expected to receive TestCase instead received ${test ? test.constructor.name : test}`);
    } else {
      this.suites.forEach(suite => {
        suite.removeTestCase(test);
      });
      this._tests.remove(test);
    }
  }

  @action.bound fromJS(jsRep) {
    this.id = jsRep.id || uuidv4();
    this.name = jsRep.name;
    this.setUrl(jsRep.url);
    this._tests.replace(jsRep.tests.map(TestCase.fromJS));
    this._suites.replace(jsRep.suites.map((suite) => Suite.fromJS(suite, this.tests)));
    this._urls.replace(jsRep.urls);
    this.modified = false;
  }

  toJSON() {
    return JSON.stringify({
      id: this.id,
      name: this.name,
      url: this.url,
      tests: this._tests,
      suites: this._suites.map(s => s.exportSuite()),
      urls: this._urls
    });
  }
}
