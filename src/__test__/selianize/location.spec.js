// Licensed to the Software Freedom Conservancy (SFC) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The SFC licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import LocationEmitter from "../../selianize/location";

describe("location code emitter", () => {
  it("should fail to emit unknown locator", () => {
    expect(LocationEmitter.emit("notExists=element")).rejects.toThrow("Unknown locator notExists");
  });
  it("should emit id locator", () => {
    const type = "id";
    const selector = "someId";
    expect(LocationEmitter.emit(`${type}=${selector}`)).resolves.toBe(`By.id("${selector}")`);
  });
  it("should emit link locator", () => {
    const type = "link";
    const selector = "someLink";
    expect(LocationEmitter.emit(`${type}=${selector}`)).resolves.toBe(`By.linkText("${selector}")`);
  });
  it("should emit css locator", () => {
    const type = "css";
    const selector = "someCss";
    expect(LocationEmitter.emit(`${type}=${selector}`)).resolves.toBe(`By.css("${selector}")`);
  });
  it("should emit xpath locator", () => {
    const type = "xpath";
    const selector = "someXpath";
    expect(LocationEmitter.emit(`${type}=${selector}`)).resolves.toBe(`By.xpath("${selector}")`);
  });
  it("should emit name locator", () => {
    const type = "name";
    const selector = "someName";
    expect(LocationEmitter.emit(`${type}=${selector}`)).resolves.toBe(`By.name("${selector}")`);
  });
});
