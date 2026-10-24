# Standards Alignment

This skill uses the concepts and vocabulary of current testing standards so its artifacts read naturally to QA teams and auditors. It does not reproduce the standards' text, and following it does not by itself make an organization conformant. Editions were checked in October 2026; confirm against the publishers before citing them in a compliance context.

| Reference | Edition | Used for |
|---|---|---|
| ISO/IEC/IEEE 29119-1 | 2022 | Test concepts: test basis, test condition, test case, test item, coverage, risk-based testing |
| ISO/IEC/IEEE 29119-2 | 2021 | Test process shape: the six phases map to analysis, design, verification, and completion activities |
| ISO/IEC/IEEE 29119-3 | 2021 | Test documentation: `traceability-matrix.json` is the bidirectional traceability record; `QUALITY-REPORT.md` follows the test completion report contents |
| ISO/IEC/IEEE 29119-4 | 2021 | Test design techniques named in matrix `technique` values |
| ISO/IEC/IEEE 29119-5 | 2024 | Keyword-driven frameworks are treated as a test automation abstraction layer in Module A |
| ISO/IEC 25010 | 2023 | `quality_characteristic` on every finding uses the nine product quality characteristics |
| ISTQB CTFL | v4.0 | Terminology (defect vs. failure, test levels, static testing, risk level), test techniques, the testing principle that exhaustive testing is impossible |
| ISTQB CTAL-TAE | v2.0 | Test automation architecture, layering, synchronization, and reliability concerns in Module A |

## Mapping to artifacts

- **Test basis → test condition → test case.** Module B follows the ISTQB and 29119 chain: requirements come from the test basis, test conditions are derived with named techniques, and coverage is judged per condition, not per requirement or per line of code.
- **Risk-based testing.** Each requirement receives a risk level from impact and likelihood; finding severity follows the protected requirement's risk level.
- **Static testing.** `QA-BASIS-DEFECT` reports untestable or ambiguous requirements, which is a review of the test basis, not of the code.
- **Defect vs. failure.** A confirmed finding is a defect in the testware; a local repeat run that changes verdict is an observed failure of that testware.
- **Test completion reporting.** `QUALITY-REPORT.md` covers what was tested, coverage achieved, deviations (deferred and out-of-scope units), residual risk (needs-validation leads and gaps), and metrics (health score, flakiness index, traceability counts).
- **Quality characteristics.** Each scanner rule declares the ISO/IEC 25010:2023 characteristic of the test suite it degrades. For example, hard waits affect reliability, brittle locators affect maintainability, and focused or assertion-free tests affect functional suitability.

## ISO/IEC 25010:2023 characteristic values

`functional_suitability`, `performance_efficiency`, `compatibility`, `interaction_capability`, `reliability`, `security`, `maintainability`, `flexibility`, `safety`.

The 2023 edition renamed usability to interaction capability and portability to flexibility, and added safety. Confirm these names against the purchased standard before using them in a formal assessment; the schema enum is the single place to change if they differ.
