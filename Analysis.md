# WHR 项目逻辑实现分析

## 项目逻辑实现分析

### 1. 核心架构

项目采用了模块化的 Ruby 实现，主要包含以下类：

-   **Base**: 主控制器，管理玩家和游戏
-   **Player**: 玩家类，包含时间序列的 rating 历史
-   **PlayerDay**: 玩家在特定日期的 rating 状态
-   **Game**: 游戏类，实现 Bradley-Terry 模型

### 2. Bradley-Terry 模型实现

在`game.rb`中正确实现了 Bradley-Terry 模型：

```ruby
def white_win_probability
  wpd.gamma/(wpd.gamma + opponents_adjusted_gamma(white_player))
end
```

这符合论文中的公式：`P(player i beats player j) = γ_i(t) / (γ_i(t) + γ_j(t))`

### 3. 牛顿法优化实现

在`player.rb`的`update_by_ndim_newton`方法中实现了多维牛顿法：

```ruby
def update_by_ndim_newton
  r = days.map(&:r)
  sigma2 = compute_sigma2
  h = hessian(days, sigma2)
  g = gradient(r, days, sigma2)
  # ... LU分解求解线性方程组
end
```

### 4. Wiener 过程先验

在`compute_sigma2`方法中实现了时间方差计算：

```ruby
def compute_sigma2
  sigma2 = []
  days.each_cons(2) do |d1,d2|
    sigma2 << (d2.day - d1.day).abs * @w2
  end
  sigma2
end
```

## 严重问题和需要改进的地方

### 1. 先验概率计算错误 ⚠️

在`player.rb`的`log_likelihood`方法中，先验概率计算有严重错误：

```ruby
prior += (1/(Math.sqrt(2*Math::PI*sigma2[i]))) * Math.exp(-(rd**2)/2*sigma2[i])
```

**问题**：这里计算的是概率密度，但应该计算对数概率密度。根据论文，Wiener 过程的对数先验应该是：

```
log p(r_i(t₂)|r_i(t₁)) = -0.5 * (r_i(t₂) - r_i(t₁))² / σ² - 0.5 * log(2πσ²)
```

**正确实现应该是**：

```ruby
prior += -0.5 * (rd**2) / sigma2[i] - 0.5 * Math.log(2*Math::PI*sigma2[i])
```

### 2. Hessian 矩阵实现不完整 ⚠️

在`hessian`方法中，只实现了对角线和次对角线元素，但根据论文附录 A，Hessian 应该是三对角矩阵：

```ruby
def hessian(days, sigma2)
  Matrix.build(n) do |row,col|
    if row == col
      prior = 0
      prior += -1.0/sigma2[row] if row < (n-1)
      prior += -1.0/sigma2[row-1] if row > 0
      days[row].log_likelihood_second_derivative + prior - 0.001
    elsif row == col-1
      1.0/sigma2[row]
    elsif row == col+1
      1.0/sigma2[col]
    else
      0
    end
  end
end
```

**问题**：缺少了论文中提到的正则化项，而且边界条件处理可能不正确。

### 3. 梯度计算不完整 ⚠️

在`gradient`方法中：

```ruby
prior += -(r[idx]-r[idx+1])/sigma2[idx] if idx < (n-1)
prior += -(r[idx]-r[idx-1])/sigma2[idx-1] if idx > 0
```

**问题**：根据论文附录 A，梯度计算应该考虑所有相邻时间点的贡献，但这里只考虑了直接相邻的点。

### 4. 不确定性估计实现不完整 ⚠️

在`covariance`方法中，只计算了方差，没有实现完整的协方差矩阵。根据论文，应该能够计算任意两个时间点之间的协方差。

### 5. 数值稳定性问题 ⚠️

代码中有多处数值稳定性检查，但处理方式不够 robust：

```ruby
if r > 650
  raise UnstableRatingException, "Unstable r (#{new_r}) on player #{inspect}"
end
```

### 6. 缺少插值公式 ⚠️

论文附录 C 提供了时间点之间的插值公式，但代码中没有实现，这会影响在非游戏时间点的 rating 估计。

## 建议的改进方案

### 1. 修复先验概率计算

使用正确的对数概率密度公式

### 2. 完善 Hessian 矩阵

确保三对角矩阵的正确实现

### 3. 改进梯度计算

考虑所有相关时间点的贡献

### 4. 实现完整协方差矩阵

支持任意时间点的协方差计算

### 5. 添加插值功能

实现论文附录 C 的插值公式

### 6. 改进数值稳定性

使用更 robust 的数值方法

### 7. 添加收敛检查

实现更智能的收敛判断

## 总结

这个实现虽然基本框架正确，但在数学细节上存在多个严重问题，特别是先验概率的计算错误会显著影响算法的正确性。
