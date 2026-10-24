# Standards Alignment

This skill uses the concepts and vocabulary of current testing standards so that its artifacts read naturally to QA teams and auditors. It does not reproduce the standards' text, and following it does not by itself make an organization conformant. Editions were checked in October 2026. Confirm them with the publishers before citing them in a compliance context.

| Reference | Edition | Used for |
|---|---|---|
| ISO/IEC/IEEE 29119-1 | 2022 | Concepts: test basis, test condition, test case, test oracle, coverage, risk-based testing |
| ISO/IEC/IEEE 29119-2 | 2021 | Process: the six phases map to test analysis, design, implementation, execution, and completion |
| ISO/IEC/IEEE 29119-3 | 2021 | Documentation: traceability (`traceability-matrix.json`), incident reports (confirmed records), test case specifications (`regression_test.test_case`), and the test completion report (`QUALITY-REPORT.md`) |
| ISO/IEC/IEEE 29119-4 | 2021 | Test design techniques named in matrix `technique` values |
| ISO/IEC/IEEE 29119-5 | 2024 | Keyword-driven test frameworks, treated as an automation abstraction layer in the `testware` module |
| ISO/IEC 25010 | 2023 | `quality_characteristic` on every finding, and the scope of the `nonfunctional` module |
| ISTQB CTFL | v4.0 | Terminology (error, defect, failure, test level, test type, static testing, severity vs. priority), test techniques, and risk-based testing |
| ISTQB CTAL-TAE | v2.0 | Test automation architecture and reliability concerns in the `testware` module and in regression script design |
| W3C WCAG | 2.2 | Default accessibility level (AA) in the `nonfunctional` module when the basis states none |

## Mapping to artifacts

- **Test basis → test condition → implementation → verdict.** Requirements come from the test basis. Test conditions are derived with named techniques, and each condition is verified against the implementation. The verdict and any defect are recorded per condition.
- **Test oracle.** Every confirmed defect names its oracle: a requirement, contract, documentation, code contract, sibling-path consistency, or a domain rule.
- **Defect vs. failure.** A confirmed record describes a defect in the code. Its reproduction shows a failure, and its regression test detects that failure.
- **Incident report.** Confirmed records carry the incident report contents: identification, environment, preconditions, steps, input, expected and actual result, impact (severity), and status (verdict). Priority is left to owners, as ISTQB separates it from severity.
- **Static testing.** `FUNC-BASIS-DEFECT` reviews the test basis itself, and source-based verdicts are static analysis of the implementation.
- **Risk-based testing.** Each requirement gets a risk level from impact and likelihood. Unit priority, severity calibration, and coverage-gap warnings follow it.
- **Test completion report.** `QUALITY-REPORT.md` covers what was tested, deviations (deferred and out-of-scope units), results, residual risk (needs-validation leads and coverage gaps), and metrics.

## ISO/IEC 25010:2023 characteristic values

`functional_suitability`, `performance_efficiency`, `compatibility`, `interaction_capability`, `reliability`, `security`, `maintainability`, `flexibility`, `safety`.

The 2023 edition renamed usability to interaction capability and portability to flexibility, and added safety. Confirm these names against the purchased standard before using them in a formal assessment. The schema enum is the single place to change if they differ.
