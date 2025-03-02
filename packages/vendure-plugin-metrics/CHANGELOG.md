# 1.7.0 (2024-12-19)

- Update Vendure to 3.1.1

# 1.6.1 (2024-12-18)

- Fixed chart text color to display correctly in dark mode.

# 1.6.0 (2024-11-19)

- Allow showing metrics of past X months instead of always past 12 months.
- Removed conversion metric, as it is can not be accurately calculated based on created orders alone
- Small improvement in query performance

# 1.5.0 (2024-11-03)

- Allow specifying per metric if it's filterable by variant ID's
- Added conversion metric
- Fixed widget ID to prevent conflicts with Vendure's built in widget

# 1.4.2 (2024-10-31)

- Added loading state for widget

# 1.4.1 (2024-10-31)

- Only fetch relations from DB when variants are passed in for better performance

# 1.4.0 (2024-10-31)

- Added revenue (per variant) metric
- Calculate with or without tax based on channel settings
- Use number instead of currency formatting for Units Sold metric
- Added a max cache age of 12 hours for metrics

# 1.3.2 (2024-10-29)

- Fix typescript build errors (#525)

# 1.3.1 (2024-08-04)

- Update compatibility range (#480)

# 1.3.0 (2024-06-21)

- Updated Vendure to 2.2.6

# 1.2.0 (2023-10-24)

- Updated vendure to 2.1.1

# 1.1.0 (2023-09-076)

- Reintroduced custom strategies and using the new Chartist charts ([#236](https://github.com/Pinelab-studio/pinelab-vendure-plugins/pull/236))
