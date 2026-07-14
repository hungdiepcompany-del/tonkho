function mainRun() {
  assertScriptOwner_();

  PropertiesService.getScriptProperties()
    .setProperty("DEBUG_RUNNING", "29041987");

  try {
    _mainInternal_();
  } finally {
    PropertiesService.getScriptProperties()
      .deleteProperty("DEBUG_RUNNING");
  }
}
