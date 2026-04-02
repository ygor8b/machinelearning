
# EDA functions
def univariate(df):
  import pandas as pd
  import numpy as np
  import matplotlib.pyplot as plt
  import seaborn as sns

  df_results = pd.DataFrame(columns=["Data Type", "Count", "Missing", "Unique", "Mode", "Min", "Q1", "Median",
                                     "Q3", "Max", "Mean", "Std", "Skew", "Kurt"])

  for col in df.columns:
    df_results.loc[col, "Data Type"] = df[col].dtype
    df_results.loc[col, "Count"] = df[col].count()
    df_results.loc[col, "Missing"] = df[col].isna().sum()
    df_results.loc[col, "Unique"] = df[col].nunique()
    df_results.loc[col, "Mode"] = df[col].mode()[0]

    if df[col].dtype in ["int64", "float64"]:
      df_results.loc[col, "Min"] = df[col].min()
      df_results.loc[col, "Q1"] = df[col].quantile(0.25)
      df_results.loc[col, "Median"] = df[col].median()
      df_results.loc[col, "Q3"] = df[col].quantile(0.75)
      df_results.loc[col, "Max"] = df[col].max()
      df_results.loc[col, "Mean"] = df[col].mean()
      df_results.loc[col, "Std"] = df[col].std()
      df_results.loc[col, "Skew"] = df[col].skew()
      df_results.loc[col, "Kurt"] = df[col].kurt()

      # Check if column is NOT boolean 0/1
      unique_vals = set(df[col].dropna().unique())
      is_boolean = unique_vals.issubset({0, 1})
      
      if not is_boolean:
        # Create stacked plot: box plot on top, histogram with KDE underneath
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 8), 
                                        gridspec_kw={'height_ratios': [1, 2], 'hspace': 0.3})
        
        # Box plot on top
        sns.boxplot(data=df, y=col, ax=ax1)
        ax1.set_title(f'Box Plot and Distribution for {col}')
        ax1.set_xlabel('')
        ax1.set_ylabel(col)
        
        # Histogram with KDE overlay underneath
        sns.histplot(data=df, x=col, kde=True, ax=ax2)
        ax2.set_xlabel(col)
        ax2.set_ylabel('Frequency')
        
        plt.tight_layout()
        plt.show()
    else:
      # Prepare for categorical plots
      plt.figure(figsize=(10, 6))
      ax = sns.countplot(data=df, x=col)
      plt.title(f'Count Plot for {col}')
      plt.xlabel(col)
      plt.ylabel('Count')
      plt.xticks(rotation=45, ha='right')
      
      # Add percentage labels above each bar
      total = len(df[col].dropna())
      for p in ax.patches:
        height = p.get_height()
        percentage = (height / total) * 100
        ax.text(p.get_x() + p.get_width() / 2., height,
                f'{percentage:.1f}%',
                ha='center', va='bottom')
      
      plt.tight_layout()
      plt.show()

  return df_results



def basic_wrangling(df):
    import pandas as pd

    # Drop columns where all values are different
    for col in df.columns:
        if df[col].nunique() == df[col].count() and not pd.api.types.is_numeric_dtype(df[col]):
            df.drop(columns=[col], inplace=True)
    
    return df

def bin_categories(df):
    import pandas as pd

    # Bin categories that make up less than 5% of the data into a new category called "Other"
    for col in df.columns:
        if pd.api.types.is_object_dtype(df[col]):
            value_counts = df[col].value_counts() / df.shape[0]
            less_than_5_percent = value_counts[value_counts < 0.05]
            df.loc[df[col].isin(less_than_5_percent.index), col] = "Other"
    
    return df


def manage_dates(df):
  import pandas as pd

  # Make a copy to avoid modifying the original dataframe
  df = df.copy()
  
  # Iterate through all columns to find date columns
  for col in df.columns:
    # Skip numeric columns - only process datetime or object/string columns
    if pd.api.types.is_numeric_dtype(df[col]):
      continue
    
    # Try to convert the column to datetime
    try:
      # Attempt to convert to datetime
      date_series = pd.to_datetime(df[col], errors='coerce')
      
      # Check if at least some values were successfully converted
      # Also verify it's not just converting numeric values
      if date_series.notna().sum() > 0:
        # Create new columns for date components
        # Day number (day of month: 1-31)
        df[f'{col}_day'] = date_series.dt.day
        
        # Weekday number (0=Monday, 6=Sunday)
        df[f'{col}_weekday'] = date_series.dt.dayofweek
        
        # Month number (1-12)
        df[f'{col}_month'] = date_series.dt.month
        
        # Year
        df[f'{col}_year'] = date_series.dt.year
        
        # Hour (if time is included, otherwise will be 0)
        df[f'{col}_hour'] = date_series.dt.hour
        
    except (ValueError, TypeError, AttributeError):
      # If conversion fails, skip this column
      continue
  
  return df


def handle_missing_data(df, features=None, col_threshold=0.5, row_threshold=0.6, 
                        test_mechanism=True, verbose=True):
  """
  Handle missing data by dropping columns and rows based on configurable thresholds,
  and test for missing data mechanisms (MAR, MCAR, MNAR).
  
  Parameters:
  -----------
  df : pandas.DataFrame
      Input dataframe to process
  features : list, optional
      List of column names to apply missing logic to. If None, applies to all columns.
      Default is None.
  col_threshold : float, optional
      Drop columns with missing percentage above this threshold (0.0 to 1.0).
      Default is 0.5 (50%).
  row_threshold : float, optional
      Drop rows with missing percentage above this threshold (0.0 to 1.0).
      Default is 0.6 (60%).
  test_mechanism : bool, optional
      Whether to run statistical tests to determine missing data mechanism.
      Default is True.
  verbose : bool, optional
      Whether to print detailed information about the process.
      Default is True.
  
  Returns:
  --------
  tuple
      A tuple containing:
      - cleaned_df : pandas.DataFrame
          Processed dataframe with dropped columns and rows
      - results_dict : dict
          Dictionary containing:
          - 'columns_dropped': List of dropped column names
          - 'rows_dropped': Number of rows dropped
          - 'original_shape': Original dataframe shape
          - 'cleaned_shape': Cleaned dataframe shape
          - 'missing_mechanism': Detected mechanism (MCAR/MAR/MNAR/UNKNOWN)
          - 'test_results': Statistical test outputs
          - 'recommendations': Handling recommendations based on mechanism
  """
  import pandas as pd
  import numpy as np
  from scipy import stats
  from scipy.stats import chi2
  
  # Make a copy to avoid modifying the original dataframe
  df_cleaned = df.copy()
  original_shape = df_cleaned.shape
  
  # Initialize results dictionary
  results_dict = {
    'columns_dropped': [],
    'rows_dropped': 0,
    'original_shape': original_shape,
    'cleaned_shape': None,
    'missing_mechanism': None,
    'test_results': {},
    'recommendations': []
  }
  
  # Validate features if provided
  if features is not None:
    missing_features = [f for f in features if f not in df_cleaned.columns]
    if missing_features:
      raise ValueError(f"Features not found in dataframe: {missing_features}")
    cols_to_check = features
  else:
    cols_to_check = list(df_cleaned.columns)
  
  if verbose:
    print(f"Processing {len(cols_to_check)} columns...")
    print(f"Original shape: {original_shape}")
  
  # Step 1: Drop columns exceeding threshold
  cols_to_drop = []
  for col in cols_to_check:
    missing_count = df_cleaned[col].isna().sum()
    missing_pct = missing_count / len(df_cleaned)
    if missing_pct > col_threshold:
      cols_to_drop.append(col)
      results_dict['columns_dropped'].append(col)
      if verbose:
        print(f"Dropping column '{col}': {missing_pct:.1%} missing (threshold: {col_threshold:.1%})")
  
  if cols_to_drop:
    df_cleaned = df_cleaned.drop(columns=cols_to_drop)
  
  # Step 2: Drop rows exceeding threshold
  if len(df_cleaned.columns) > 0:
    missing_per_row = df_cleaned.isnull().sum(axis=1) / len(df_cleaned.columns)
    rows_to_drop = missing_per_row > row_threshold
    rows_dropped_count = rows_to_drop.sum()
    
    if rows_dropped_count > 0:
      df_cleaned = df_cleaned[~rows_to_drop]
      results_dict['rows_dropped'] = rows_dropped_count
      if verbose:
        print(f"Dropping {rows_dropped_count} rows with >{row_threshold:.1%} missing values")
  
  results_dict['cleaned_shape'] = df_cleaned.shape
  
  if verbose:
    print(f"Cleaned shape: {results_dict['cleaned_shape']}")
    print(f"Total columns dropped: {len(results_dict['columns_dropped'])}")
    print(f"Total rows dropped: {results_dict['rows_dropped']}")
  
  # Step 3: Test for missing data mechanism
  if test_mechanism and len(df_cleaned.columns) > 0:
    if verbose:
      print("\nTesting missing data mechanism...")
    
    mechanism, test_results = _test_missing_mechanism(df_cleaned, verbose=verbose)
    results_dict['missing_mechanism'] = mechanism
    results_dict['test_results'] = test_results
    
    # Step 4: Generate recommendations
    recommendations = _generate_recommendations(mechanism, test_results)
    results_dict['recommendations'] = recommendations
    
    if verbose:
      print(f"\nDetected missing data mechanism: {mechanism}")
      print("\nRecommendations:")
      for i, rec in enumerate(recommendations, 1):
        print(f"  {i}. {rec}")
  
  return df_cleaned, results_dict


def _test_missing_mechanism(df, verbose=True):
  """
  Test for missing data mechanism (MCAR, MAR, MNAR).
  
  Parameters:
  -----------
  df : pandas.DataFrame
      Dataframe to test
  verbose : bool
      Whether to print test details
  
  Returns:
  --------
  tuple
      (mechanism, test_results_dict)
  """
  import pandas as pd
  import numpy as np
  from scipy import stats
  from scipy.stats import chi2
  
  test_results = {}
  mechanism = "UNKNOWN"
  
  # Get columns with missing data
  missing_cols = [col for col in df.columns if df[col].isna().sum() > 0]
  
  if len(missing_cols) == 0:
    if verbose:
      print("No missing data found in dataframe.")
    return "NO_MISSING", test_results
  
  if len(missing_cols) == 0 or len(df.columns) < 2:
    return "INSUFFICIENT_DATA", test_results
  
  # Test 1: Little's MCAR Test (simplified version)
  # This tests if missingness is completely random
  try:
    mcar_result = _littles_mcar_test(df, missing_cols, verbose=verbose)
    test_results['littles_mcar'] = mcar_result
    
    if mcar_result['p_value'] > 0.05:
      mechanism = "MCAR"
      if verbose:
        print(f"Little's MCAR test: p-value = {mcar_result['p_value']:.4f} (p > 0.05 suggests MCAR)")
    else:
      # If not MCAR, test for MAR vs MNAR
      mar_mnar_result = _test_mar_vs_mnar(df, missing_cols, verbose=verbose)
      test_results['mar_mnar_analysis'] = mar_mnar_result
      
      if mar_mnar_result['likely_mar']:
        mechanism = "MAR"
      else:
        mechanism = "MNAR"
        
  except Exception as e:
    if verbose:
      print(f"Error in statistical tests: {e}")
      print("Falling back to pattern analysis...")
    
    # Fallback: Pattern analysis
    pattern_result = _pattern_analysis(df, missing_cols, verbose=verbose)
    test_results['pattern_analysis'] = pattern_result
    
    if pattern_result['strong_correlation_with_observed']:
      mechanism = "MAR"
    elif pattern_result['strong_correlation_with_self']:
      mechanism = "MNAR"
    else:
      mechanism = "UNKNOWN"
  
  return mechanism, test_results


def _littles_mcar_test(df, missing_cols, verbose=True):
  """
  Simplified version of Little's MCAR test.
  Tests the null hypothesis that data is Missing Completely At Random.
  
  Parameters:
  -----------
  df : pandas.DataFrame
      Dataframe to test
  missing_cols : list
      List of columns with missing data
  
  Returns:
  --------
  dict
      Test results including chi-square statistic and p-value
  """
  import pandas as pd
  import numpy as np
  from scipy.stats import chi2
  
  # Create missingness indicator matrix
  missing_indicator = df[missing_cols].isnull().astype(int)
  
  # Get complete cases (rows with no missing in these columns)
  complete_cases = df[missing_cols].dropna()
  
  if len(complete_cases) == 0 or len(missing_indicator) == 0:
    return {
      'statistic': None,
      'p_value': None,
      'df': None,
      'note': 'Insufficient data for Little\'s MCAR test'
    }
  
  # Calculate expected missingness pattern under MCAR
  # Under MCAR, missingness should be independent of observed values
  # We compare observed missingness patterns across different groups
  
  # Group by missingness patterns
  pattern_counts = missing_indicator.groupby(list(missing_indicator.columns)).size()
  
  # If only one pattern, cannot perform test
  if len(pattern_counts) < 2:
    return {
      'statistic': None,
      'p_value': None,
      'df': None,
      'note': 'Insufficient missingness patterns for Little\'s MCAR test'
    }
  
  # Simplified test: Check if missingness is independent of observed values
  # by comparing means of observed variables across missingness patterns
  numeric_cols = [col for col in df.columns if col not in missing_cols and 
                  pd.api.types.is_numeric_dtype(df[col])]
  
  if len(numeric_cols) == 0:
    # Fallback: use chi-square test on missingness patterns
    expected = len(missing_indicator) / len(pattern_counts)
    chi2_stat = ((pattern_counts - expected) ** 2 / expected).sum()
    df_chi2 = len(pattern_counts) - 1
    p_value = 1 - chi2.cdf(chi2_stat, df_chi2) if df_chi2 > 0 else None
    
    return {
      'statistic': chi2_stat,
      'p_value': p_value,
      'df': df_chi2,
      'note': 'Chi-square test on missingness patterns'
    }
  
  # Compare means across missingness groups
  # Under MCAR, means should be similar across groups
  group_means = []
  for pattern, group_df in missing_indicator.groupby(list(missing_indicator.columns)):
    if len(group_df) > 0:
      indices = group_df.index
      group_data = df.loc[indices, numeric_cols].mean()
      group_means.append(group_data.values)
  
  if len(group_means) < 2:
    return {
      'statistic': None,
      'p_value': None,
      'df': None,
      'note': 'Insufficient groups for comparison'
    }
  
  # Perform ANOVA-like test (simplified)
  # If MCAR, group means should not differ significantly
  try:
    from scipy.stats import f_oneway
    f_stat, p_value = f_oneway(*group_means)
    
    return {
      'statistic': f_stat,
      'p_value': p_value,
      'df': (len(group_means) - 1, len(missing_indicator) - len(group_means)),
      'note': 'F-test comparing means across missingness patterns'
    }
  except:
    # Fallback to simpler test
    return {
      'statistic': None,
      'p_value': 0.01,  # Conservative: assume not MCAR if test fails
      'df': None,
      'note': 'Test computation failed, assuming non-MCAR'
    }


def _test_mar_vs_mnar(df, missing_cols, verbose=True):
  """
  Test to distinguish MAR (Missing At Random) from MNAR (Missing Not At Random).
  
  Parameters:
  -----------
  df : pandas.DataFrame
      Dataframe to test
  missing_cols : list
      List of columns with missing data
  
  Returns:
  --------
  dict
      Analysis results indicating likely mechanism
  """
  import pandas as pd
  import numpy as np
  from scipy.stats import pearsonr
  
  result = {
    'likely_mar': False,
    'likely_mnar': False,
    'correlations_with_observed': {},
    'correlations_with_self': {}
  }
  
  # Get observed (non-missing) columns
  observed_cols = [col for col in df.columns if col not in missing_cols and 
                   pd.api.types.is_numeric_dtype(df[col])]
  
  if len(observed_cols) == 0:
    return result
  
  # For each missing column, check correlations
  for col in missing_cols:
    if not pd.api.types.is_numeric_dtype(df[col]):
      continue
    
    # Create missingness indicator
    missing_indicator = df[col].isnull().astype(int)
    
    # Test MAR: Missingness correlates with observed variables
    mar_correlations = {}
    for obs_col in observed_cols:
      try:
        # Remove rows where both are missing
        valid_mask = df[[col, obs_col]].notna().all(axis=1)
        if valid_mask.sum() > 10:  # Need sufficient data
          corr, p_val = pearsonr(missing_indicator[valid_mask], 
                                 df.loc[valid_mask, obs_col])
          if abs(corr) > 0.1 and p_val < 0.05:  # Significant correlation
            mar_correlations[obs_col] = {'correlation': corr, 'p_value': p_val}
      except:
        continue
    
    result['correlations_with_observed'][col] = mar_correlations
    
    # Test MNAR: Missingness correlates with the variable itself
    # (This is tricky since we can't observe missing values)
    # Instead, we check if observed values differ significantly from what we'd expect
    try:
      observed_values = df[col].dropna()
      if len(observed_values) > 10:
        # Check if observed values are skewed (suggesting MNAR)
        # If high values are missing, observed mean will be lower
        # This is a heuristic, not a definitive test
        mean_obs = observed_values.mean()
        std_obs = observed_values.std()
        
        # Create indicator for "extreme" observed values
        # If missingness is MNAR, we might see clustering
        z_scores = (observed_values - mean_obs) / std_obs if std_obs > 0 else np.zeros(len(observed_values))
        extreme_count = (np.abs(z_scores) > 2).sum()
        extreme_pct = extreme_count / len(observed_values)
        
        result['correlations_with_self'][col] = {
          'mean': mean_obs,
          'std': std_obs,
          'extreme_pct': extreme_pct,
          'note': 'Heuristic: high extreme_pct may suggest MNAR'
        }
    except:
      pass
  
  # Determine likely mechanism
  strong_mar_evidence = sum(len(corrs) > 0 for corrs in result['correlations_with_observed'].values())
  strong_mnar_evidence = any(
    info.get('extreme_pct', 0) > 0.1 
    for info in result['correlations_with_self'].values()
  )
  
  if strong_mar_evidence > strong_mnar_evidence:
    result['likely_mar'] = True
  elif strong_mnar_evidence:
    result['likely_mnar'] = True
  
  return result


def _pattern_analysis(df, missing_cols, verbose=True):
  """
  Fallback pattern analysis for missing data mechanism.
  
  Parameters:
  -----------
  df : pandas.DataFrame
      Dataframe to analyze
  missing_cols : list
      List of columns with missing data
  
  Returns:
  --------
  dict
      Pattern analysis results
  """
  import pandas as pd
  import numpy as np
  
  result = {
    'strong_correlation_with_observed': False,
    'strong_correlation_with_self': False,
    'missing_patterns': {}
  }
  
  observed_cols = [col for col in df.columns if col not in missing_cols and 
                   pd.api.types.is_numeric_dtype(df[col])]
  
  for col in missing_cols:
    missing_indicator = df[col].isnull().astype(int)
    missing_pct = missing_indicator.mean()
    
    result['missing_patterns'][col] = {
      'missing_percentage': missing_pct,
      'correlated_observed_vars': []
    }
    
    # Check correlations with observed variables
    for obs_col in observed_cols:
      try:
        valid_mask = df[[col, obs_col]].notna().all(axis=1)
        if valid_mask.sum() > 10:
          corr = np.corrcoef(missing_indicator[valid_mask], 
                            df.loc[valid_mask, obs_col])[0, 1]
          if abs(corr) > 0.2:
            result['missing_patterns'][col]['correlated_observed_vars'].append({
              'variable': obs_col,
              'correlation': corr
            })
            result['strong_correlation_with_observed'] = True
      except:
        continue
  
  return result


def _generate_recommendations(mechanism, test_results):
  """
  Generate handling recommendations based on detected missing data mechanism.
  
  Parameters:
  -----------
  mechanism : str
      Detected mechanism (MCAR, MAR, MNAR, UNKNOWN)
  test_results : dict
      Test results dictionary
  
  Returns:
  --------
  list
      List of recommendation strings
  """
  recommendations = []
  
  if mechanism == "MCAR":
    recommendations.append(
      "Simple imputation methods work well: mean/median for numeric, mode for categorical"
    )
    recommendations.append(
      "Listwise deletion is acceptable if missing data is < 5-10%"
    )
    recommendations.append(
      "Consider: Simple imputation (mean/median/mode), KNN imputation, or regression imputation"
    )
  
  elif mechanism == "MAR":
    recommendations.append(
      "Use advanced imputation methods that leverage relationships with other variables"
    )
    recommendations.append(
      "Recommended: Multiple Imputation by Chained Equations (MICE), KNN imputation, or Random Forest imputation"
    )
    recommendations.append(
      "Avoid simple mean/median imputation as it may introduce bias"
    )
    recommendations.append(
      "Consider including variables that predict missingness in your imputation model"
    )
  
  elif mechanism == "MNAR":
    recommendations.append(
      "Most challenging case - missingness depends on unobserved values"
    )
    recommendations.append(
      "Consider sensitivity analysis to understand impact of missing data"
    )
    recommendations.append(
      "Domain expertise is crucial - understand why data is missing"
    )
    recommendations.append(
      "Consider: Pattern mixture models, selection models, or treating missingness as informative"
    )
    recommendations.append(
      "Simple deletion or basic imputation may introduce significant bias"
    )
  
  else:
    recommendations.append(
      "Unable to definitively determine missing data mechanism"
    )
    recommendations.append(
      "Use conservative approach: try multiple imputation methods and compare results"
    )
    recommendations.append(
      "Consider domain knowledge to understand missingness patterns"
    )
  
  # General recommendations
  recommendations.append(
    "Never impute missing values in your outcome/target variable (y)"
  )
  recommendations.append(
    "Always validate imputation results and compare with complete case analysis"
  )
  
  return recommendations


def normalize(df, label=None):
  """
  Normalize numerical features or label by testing skewness and applying the best transformation.
  
  Parameters:
  -----------
  df : pandas.DataFrame
      Input dataframe to process
  label : str, optional
      Name of the label/target column. If provided, only normalizes this column.
      If None, normalizes all numerical features. Default is None.
  
  Returns:
  --------
  pandas.DataFrame
      DataFrame with transformed column(s) appended (original columns preserved)
  """
  import pandas as pd
  import numpy as np
  from scipy import stats
  from sklearn.preprocessing import PowerTransformer
  
  # Make a copy to avoid modifying the original dataframe
  df_result = df.copy()
  
  # Determine which columns to normalize
  if label is not None:
    if label not in df_result.columns:
      raise ValueError(f"Label column '{label}' not found in dataframe")
    cols_to_normalize = [label]
  else:
    # Get all numerical columns
    cols_to_normalize = [col for col in df_result.columns 
                        if pd.api.types.is_numeric_dtype(df_result[col])]
  
  if len(cols_to_normalize) == 0:
    print("No numerical columns found to normalize.")
    return df_result
  
  # Process each column
  for col in cols_to_normalize:
    # Get the column data, dropping NaN values for transformation testing
    col_data = df_result[col].dropna()
    
    if len(col_data) == 0:
      print(f"Skipping column '{col}': no valid data")
      continue
    
    # Calculate original skewness
    original_skew = col_data.skew()
    
    if pd.isna(original_skew) or abs(original_skew) < 0.01:
      print(f"Column '{col}' already has low skewness ({original_skew:.4f}), skipping transformation")
      continue
    
    print(f"\nProcessing column '{col}':")
    print(f"  Original skewness: {original_skew:.4f}")
    
    # Store transformation results
    transformations = {}
    
    # Determine which transformations to try based on skewness direction
    is_positive_skew = original_skew > 0
    
    # Calculate shift values from the non-NaN data for transformations
    col_min = col_data.min()
    col_mean = col_data.mean()
    
    # Try transformations based on skewness direction
    if is_positive_skew:
      # For positive skewness: try reducing transformations
      def sqrt_trans(x):
        result = x.copy()
        valid = x.notna()
        result.loc[valid] = np.sqrt(x.loc[valid] - col_min + 1)
        return result
      
      def cbrt_trans(x):
        result = x.copy()
        valid = x.notna()
        result.loc[valid] = np.cbrt(x.loc[valid] - col_min + 1)
        return result
      
      def ln_trans(x):
        result = x.copy()
        valid = x.notna()
        result.loc[valid] = np.log(x.loc[valid] - col_min + 1)
        return result
      
      transformations_to_try = {
        'sqrt': sqrt_trans,
        'cbrt': cbrt_trans,
        'ln': ln_trans,
        'yeojohnson': None  # Special handling below
      }
    else:
      # For negative skewness: try increasing transformations
      def square_trans(x):
        result = x.copy()
        valid = x.notna()
        result.loc[valid] = x.loc[valid] ** 2
        return result
      
      def cube_trans(x):
        result = x.copy()
        valid = x.notna()
        result.loc[valid] = x.loc[valid] ** 3
        return result
      
      def exp_trans(x):
        result = x.copy()
        valid = x.notna()
        result.loc[valid] = np.exp(x.loc[valid] - col_mean)
        return result
      
      transformations_to_try = {
        'square': square_trans,
        'cube': cube_trans,
        'exp': exp_trans,
        'yeojohnson': None  # Special handling below
      }
    
    # Test each transformation
    for trans_name, trans_func in transformations_to_try.items():
      try:
        if trans_name == 'yeojohnson':
          # YeoJohnson can handle both positive and negative values
          # Need to handle NaN values properly
          valid_mask = df_result[col].notna()
          if valid_mask.sum() < 2:
            continue
          
          # Prepare data for YeoJohnson
          yj_data = df_result.loc[valid_mask, col].values.reshape(-1, 1)
          
          # Apply YeoJohnson transformation
          pt = PowerTransformer(method='yeo-johnson', standardize=False)
          yj_transformed = pt.fit_transform(yj_data).flatten()
          
          # Calculate skewness on transformed data
          transformed_skew = stats.skew(yj_transformed)
          
          transformations[trans_name] = {
            'skewness': transformed_skew,
            'abs_skewness': abs(transformed_skew),
            'transformer': pt,
            'valid_mask': valid_mask
          }
        else:
          # Apply transformation function to test data
          transformed = trans_func(col_data)
          
          # Check for invalid values (inf, nan) - only check non-NaN values
          valid_transformed = transformed.dropna()
          if len(valid_transformed) == 0 or np.any(~np.isfinite(valid_transformed)):
            continue
          
          # Calculate skewness on transformed data (only non-NaN values)
          transformed_skew = stats.skew(valid_transformed)
          
          transformations[trans_name] = {
            'skewness': transformed_skew,
            'abs_skewness': abs(transformed_skew),
            'transformer': trans_func
          }
      except Exception as e:
        # Skip transformations that fail
        continue
    
    # Find the best transformation (closest to zero skewness)
    if len(transformations) == 0:
      print(f"  No valid transformations found for column '{col}'")
      continue
    
    best_trans = min(transformations.items(), key=lambda x: x[1]['abs_skewness'])
    best_name, best_info = best_trans
    
    print(f"  Best transformation: {best_name} (skewness: {best_info['skewness']:.4f})")
    
    # Apply the best transformation to the entire column
    new_col_name = f"{col}_{best_name}"
    
    if best_name == 'yeojohnson':
      # Use the fitted transformer
      valid_mask = best_info['valid_mask']
      yj_data = df_result.loc[valid_mask, col].values.reshape(-1, 1)
      transformed_values = best_info['transformer'].transform(yj_data).flatten()
      
      # Create new column with NaN preserved
      df_result[new_col_name] = np.nan
      df_result.loc[valid_mask, new_col_name] = transformed_values
    else:
      # Apply the transformation function
      trans_func = best_info['transformer']
      df_result[new_col_name] = trans_func(df_result[col])
    
    print(f"  Added transformed column: '{new_col_name}'")
  
  return df_result


def manage_outliers(df, eps=0.5, min_samples=5, drop_outliers=False, features=None, verbose=True):
  """
  Identify outliers using DBSCAN clustering and optionally remove them.
  
  Parameters:
  -----------
  df : pandas.DataFrame
      Input dataframe to process
  eps : float, optional
      Maximum distance between samples for DBSCAN clustering (tightness parameter).
      Smaller values = tighter clustering (more outliers detected).
      Larger values = looser clustering (fewer outliers detected).
      Default is 0.5.
  min_samples : int, optional
      Minimum number of samples in a neighborhood for a point to be a core point.
      Smaller values = more sensitive to outliers.
      Larger values = less sensitive to outliers.
      Default is 5.
  drop_outliers : bool, optional
      If True, drop outlier rows from the returned dataframe.
      If False, keep all rows but mark outliers.
      Default is False.
  features : list, optional
      List of column names to use for outlier detection. If None, uses all numerical columns.
      Default is None.
  verbose : bool, optional
      Whether to print detailed information about the process.
      Default is True.
  
  Returns:
  --------
  tuple
      A tuple containing:
      - processed_df : pandas.DataFrame
          Processed dataframe (with or without outliers depending on drop_outliers)
      - report_df : pandas.DataFrame
          Report containing:
          - Total number of outliers
          - Percentage of outliers
          - Column-wise contribution to outliers (z-scores, mean distance, etc.)
  """
  import pandas as pd
  import numpy as np
  from sklearn.cluster import DBSCAN
  from sklearn.preprocessing import StandardScaler
  
  # Make a copy to avoid modifying the original dataframe
  df_result = df.copy()
  
  # Determine which columns to use for outlier detection
  if features is not None:
    missing_features = [f for f in features if f not in df_result.columns]
    if missing_features:
      raise ValueError(f"Features not found in dataframe: {missing_features}")
    cols_to_use = features
  else:
    # Use all numerical columns
    cols_to_use = [col for col in df_result.columns 
                   if pd.api.types.is_numeric_dtype(df_result[col])]
  
  if len(cols_to_use) == 0:
    raise ValueError("No numerical columns found for outlier detection")
  
  if verbose:
    print(f"Using {len(cols_to_use)} features for outlier detection:")
    print(f"  Features: {', '.join(cols_to_use)}")
    print(f"  DBSCAN parameters: eps={eps}, min_samples={min_samples}")
  
  # Prepare data for DBSCAN
  # Get rows with no missing values in the selected features
  valid_mask = df_result[cols_to_use].notna().all(axis=1)
  valid_data = df_result.loc[valid_mask, cols_to_use].copy()
  
  if len(valid_data) < min_samples:
    raise ValueError(f"Insufficient data: need at least {min_samples} complete rows, got {len(valid_data)}")
  
  if verbose:
    print(f"\nValid rows (no missing values in features): {len(valid_data)} / {len(df_result)}")
  
  # Standardize the data (DBSCAN is sensitive to scale)
  scaler = StandardScaler()
  scaled_data = scaler.fit_transform(valid_data)
  
  # Apply DBSCAN clustering
  dbscan = DBSCAN(eps=eps, min_samples=min_samples)
  cluster_labels = dbscan.fit_predict(scaled_data)
  
  # Identify outliers (DBSCAN labels outliers as -1)
  outlier_mask = cluster_labels == -1
  n_outliers = outlier_mask.sum()
  n_clusters = len(set(cluster_labels)) - (1 if -1 in cluster_labels else 0)
  
  if verbose:
    print(f"\nDBSCAN Results:")
    print(f"  Number of clusters found: {n_clusters}")
    print(f"  Number of outliers detected: {n_outliers}")
    print(f"  Percentage of outliers: {n_outliers/len(valid_data)*100:.2f}%")
  
  # Create outlier indicator column in the full dataframe
  df_result['_is_outlier'] = False
  df_result.loc[valid_mask, '_is_outlier'] = outlier_mask
  
  # Analyze which columns contribute most to outlier detection
  if n_outliers > 0:
    # Get outlier rows
    outlier_indices = valid_data.index[outlier_mask]
    outlier_data = valid_data.loc[outlier_indices]
    
    # Calculate statistics for normal (non-outlier) data
    normal_data = valid_data.loc[~outlier_mask]
    normal_means = normal_data.mean()
    normal_stds = normal_data.std()
    
    # Calculate z-scores for outliers (how many standard deviations from normal mean)
    z_scores = {}
    mean_distances = {}
    max_deviations = {}
    
    for col in cols_to_use:
      if normal_stds[col] > 0:  # Avoid division by zero
        # Z-scores for outlier rows
        outlier_zs = (outlier_data[col] - normal_means[col]) / normal_stds[col]
        z_scores[col] = outlier_zs.abs().mean()
        max_deviations[col] = outlier_zs.abs().max()
        
        # Mean absolute distance from normal mean (in original scale)
        mean_distances[col] = (outlier_data[col] - normal_means[col]).abs().mean()
      else:
        z_scores[col] = 0
        mean_distances[col] = 0
        max_deviations[col] = 0
    
    # Create report DataFrame with column analysis
    report_data = {
      'Column': cols_to_use,
      'Mean_Z_Score': [z_scores[col] for col in cols_to_use],
      'Max_Z_Score': [max_deviations[col] for col in cols_to_use],
      'Mean_Distance': [mean_distances[col] for col in cols_to_use],
      'Normal_Mean': [normal_means[col] for col in cols_to_use],
      'Normal_Std': [normal_stds[col] for col in cols_to_use],
      'Outlier_Mean': [outlier_data[col].mean() for col in cols_to_use]
    }
    
    report_df = pd.DataFrame(report_data)
    # Sort by mean z-score (descending) to show most contributing columns first
    report_df = report_df.sort_values('Mean_Z_Score', ascending=False).reset_index(drop=True)
    
    if verbose:
      print(f"\nTop 5 columns contributing to outliers (by mean z-score):")
      # Get top 5 columns (skip summary rows)
      top_cols = report_df[report_df['Mean_Z_Score'].notna()].head(5)
      for idx, row in top_cols.iterrows():
        print(f"  {row['Column']}: Mean Z-Score = {row['Mean_Z_Score']:.3f}, "
              f"Max Z-Score = {row['Max_Z_Score']:.3f}")
  else:
    # No outliers found
    report_data = {
      'Column': ['SUMMARY'],
      'Mean_Z_Score': [np.nan],
      'Max_Z_Score': [np.nan],
      'Mean_Distance': [np.nan],
      'Normal_Mean': [np.nan],
      'Normal_Std': [np.nan],
      'Outlier_Mean': [np.nan]
    }
    report_df = pd.DataFrame(report_data)
    if verbose:
      print("\nNo outliers detected.")
  
  # Add summary information at the top of report DataFrame
  summary_rows = pd.DataFrame({
    'Column': ['--- SUMMARY ---', 
               f'Total Rows: {len(df_result)}',
               f'Valid Rows: {len(valid_data)}',
               f'Outliers Detected: {n_outliers}',
               f'Outlier Percentage: {n_outliers/len(valid_data)*100:.2f}%' if len(valid_data) > 0 else 'Outlier Percentage: 0%',
               f'Clusters Found: {n_clusters}',
               f'EPS Parameter: {eps}',
               f'Min Samples Parameter: {min_samples}',
               '--- COLUMN ANALYSIS ---'],
    'Mean_Z_Score': [np.nan] * 9,
    'Max_Z_Score': [np.nan] * 9,
    'Mean_Distance': [np.nan] * 9,
    'Normal_Mean': [np.nan] * 9,
    'Normal_Std': [np.nan] * 9,
    'Outlier_Mean': [np.nan] * 9
  })
  
  if n_outliers > 0:
    report_df = pd.concat([summary_rows, report_df], ignore_index=True)
  else:
    # If no outliers, just show summary
    report_df = summary_rows
  
  # Optionally drop outliers
  if drop_outliers:
    rows_before = len(df_result)
    df_result = df_result[~df_result['_is_outlier']].copy()
    rows_after = len(df_result)
    if verbose:
      print(f"\nDropped {rows_before - rows_after} outlier rows.")
      print(f"Remaining rows: {rows_after}")
  else:
    if verbose:
      print(f"\nOutliers marked but not dropped. Use '_is_outlier' column to filter.")
  
  # Remove the temporary outlier indicator column if not dropping
  if not drop_outliers:
    # Keep it for user reference, but could remove if desired
    pass  # Keeping it for now so user can see which rows are outliers
  
  return df_result, report_df

  